import { useState, useCallback } from 'react';
import { NetworkNode, Connection, FirewallRule, Phase, SimulationPacket, FirewallPolicy, AddressList } from '@/types/firewall';
import { Scenario } from '@/types/scenario';
import { nextVlanId, vlanAddressing, nextHostIp } from '@/lib/addressing';
import { layoutVlanRow, hostOffset } from '@/lib/layout';
import { nextNodeName } from '@/lib/nodeNames';

const ROUTER_ID = 'router-main';

/** Unique id: Date.now() alone collides when two items are added in the same millisecond. */
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

/**
 * Rules sorted by `order` and renumbered 0..n-1. Every change to the rule
 * list goes through this, so order values stay unique and gap-free and the
 * array order always equals the evaluation order the student sees.
 */
const renumber = (rules: FirewallRule[]) =>
  [...rules].sort((a, b) => a.order - b.order).map((r, idx) => ({ ...r, order: idx }));

const initialNodes: NetworkNode[] = [
  { id: ROUTER_ID, type: 'router', name: 'Router', x: 400, y: 300, parentId: null }
];

export function useNetworkState() {
  const [phase, setPhase] = useState<Phase>(1);
  const [nodes, setNodes] = useState<NetworkNode[]>(initialNodes);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [firewallPolicy, setFirewallPolicy] = useState<FirewallPolicy>('block-all');
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [simulation, setSimulation] = useState<SimulationPacket | null>(null);
  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [addressLists, setAddressLists] = useState<AddressList[]>([]);

  const generateId = () => makeId('node');

  const addNode = useCallback((type: 'internet' | 'vlan' | 'host') => {
    const newId = generateId();
    // Resolved inside the setNodes updater (always against the latest
    // committed state, see below) and read again for the setConnections
    // call right after — safe because React runs queued updaters in order.
    let parentId: string | null = null;

    setNodes(prev => {
      let x = 400;
      let y = 100;
      let resolvedParentId: string = ROUTER_ID;
      let vlanId: number | undefined;
      let subnet: string | undefined;
      let gateway: string | undefined;
      let ip: string | undefined;

      if (type === 'internet') {
        y = 80;
        resolvedParentId = ROUTER_ID;
      } else if (type === 'vlan') {
        // Compute against the latest committed nodes, not a stale closure —
        // two addNode('vlan') calls fired before a re-render (e.g. an
        // impatient double-click) would otherwise both see 0 existing VLANs
        // and hand out the same vlanId/subnet.
        const vlanCount = prev.filter(n => n.type === 'vlan').length;
        x = 200 + vlanCount * 200;
        y = 500;
        resolvedParentId = ROUTER_ID;

        vlanId = nextVlanId(prev);
        // No free VLAN id left (253 in use): the VLAN is still added, without addressing.
        if (vlanId !== undefined) ({ subnet, gateway } = vlanAddressing(vlanId));
      } else if (type === 'host') {
        // Host must be attached to a router or VLAN
        const parentNode = selectedNodeId ? prev.find(n => n.id === selectedNodeId) : null;

        if (parentNode && (parentNode.type === 'router' || parentNode.type === 'vlan')) {
          // Attach to selected router or VLAN
          const existingChildren = prev.filter(n => n.parentId === selectedNodeId).length;
          // Spread children horizontally around the parent
          const offset = (existingChildren - Math.floor(existingChildren / 2)) * 120;
          x = parentNode.x + offset;
          y = parentNode.y + 150;
          resolvedParentId = parentNode.id;
        } else {
          // Fallback: attach directly to the main router
          const routerNode = prev.find(n => n.id === ROUTER_ID);
          const existingChildren = prev.filter(n => n.parentId === ROUTER_ID && n.type === 'host').length;
          x = (routerNode?.x || 400) + 150 + existingChildren * 120;
          y = (routerNode?.y || 300) + 150;
          resolvedParentId = ROUTER_ID;
        }

        // Assign the next free host address in the parent VLAN's subnet (or
        // in the fallback segment for hosts attached straight to the router).
        const parent = prev.find(n => n.id === resolvedParentId);
        ip = nextHostIp(prev, resolvedParentId, parent);
      }

      parentId = resolvedParentId;

      const newNode: NetworkNode = {
        id: newId,
        type,
        name: nextNodeName(prev, type),
        x,
        y,
        parentId: resolvedParentId,
        ...(vlanId !== undefined && { vlanId }),
        ...(subnet !== undefined && { subnet }),
        ...(gateway !== undefined && { gateway }),
        ...(ip !== undefined && { ip })
      };

      return [...prev, newNode];
    });

    setConnections(prev => {
      if (!parentId) return prev;
      return [...prev, { id: makeId('conn'), fromId: parentId, toId: newId }];
    });
  }, [selectedNodeId]);

  const updateNode = useCallback((id: string, updates: Partial<NetworkNode>) => {
    setNodes(prev => prev.map(node =>
      node.id === id ? { ...node, ...updates } : node
    ));
  }, []);

  const deleteNode = useCallback((id: string) => {
    if (id === ROUTER_ID) return;

    const nodesToDelete = new Set<string>([id]);
    const findChildren = (parentId: string) => {
      nodes.forEach(n => {
        if (n.parentId === parentId) {
          nodesToDelete.add(n.id);
          findChildren(n.id);
        }
      });
    };
    findChildren(id);

    setNodes(prev => prev.filter(n => !nodesToDelete.has(n.id)));
    setConnections(prev => prev.filter(c =>
      !nodesToDelete.has(c.fromId) && !nodesToDelete.has(c.toId)
    ));
    // An address list whose members are all deleted would match nothing, so
    // the rules using it would silently never apply: remove the list and
    // those rules too, just like rules that use a deleted node directly.
    const emptiedListIds = new Set(addressLists
      .filter(list => list.memberIds.length > 0 && list.memberIds.every(m => nodesToDelete.has(m)))
      .map(list => list.id));
    const isGone = (id: string) => nodesToDelete.has(id) || emptiedListIds.has(id);

    setRules(prev => renumber(prev.filter(r => !isGone(r.sourceId) && !isGone(r.destinationId))));
    setAddressLists(prev => prev
      .filter(list => !emptiedListIds.has(list.id))
      .map(list => ({
        ...list,
        memberIds: list.memberIds.filter(id => !nodesToDelete.has(id))
      })));
    if (selectedNodeId && nodesToDelete.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId, addressLists]);

  const addAddressList = useCallback((name: string, memberIds: string[]) => {
    const newList: AddressList = {
      id: makeId('list'),
      name,
      memberIds
    };
    setAddressLists(prev => [...prev, newList]);
  }, []);

  const updateAddressList = useCallback((id: string, updates: Partial<AddressList>) => {
    setAddressLists(prev => prev.map(list => (list.id === id ? { ...list, ...updates } : list)));
  }, []);

  const deleteAddressList = useCallback((id: string) => {
    setAddressLists(prev => prev.filter(list => list.id !== id));
    // A rule that referenced this list no longer has a valid source/destination.
    setRules(prev => renumber(prev.filter(r => r.sourceId !== id && r.destinationId !== id)));
  }, []);

  const addRule = useCallback((rule: Omit<FirewallRule, 'id' | 'order'>) => {
    // Order is computed from the latest state inside the updater, not from a
    // closure, so two adds before a re-render still get 0 and 1.
    setRules(prev => renumber([...prev, { ...rule, id: makeId('rule'), order: prev.length }]));
  }, []);

  const deleteRule = useCallback((id: string) => {
    setRules(prev => renumber(prev.filter(r => r.id !== id)));
  }, []);

  // Indexes are positions in the list as shown (sorted by order).
  const reorderRules = useCallback((startIndex: number, endIndex: number) => {
    setRules(prev => {
      const result = renumber(prev);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return result.map((r, idx) => ({ ...r, order: idx }));
    });
  }, []);

  const resetNetwork = useCallback(() => {
    setNodes(initialNodes);
    setConnections([]);
    setSelectedNodeId(null);
    setFirewallPolicy('block-all');
    setRules([]);
    setSimulation(null);
    setPhase(1);
    setActiveScenario(null);
    setAddressLists([]);
  }, []);

  // Builds a fresh topology from a scenario's node/host names, reusing the
  // same auto-addressing as addNode so scenario-loaded and manually-added
  // nodes are indistinguishable in the rest of the app.
  const loadScenario = useCallback((scenario: Scenario) => {
    const newNodes: NetworkNode[] = [
      { id: ROUTER_ID, type: 'router', name: 'Router', x: 400, y: 300, parentId: null }
    ];
    const newConnections: Connection[] = [];

    if (scenario.topology.internet) {
      const internetId = generateId();
      newNodes.push({ id: internetId, type: 'internet', name: 'Internet', x: 400, y: 80, parentId: ROUTER_ID, scenarioRef: 'Internet' });
      newConnections.push({ id: `conn-${internetId}`, fromId: ROUTER_ID, toId: internetId });
    }

    const hostsPerVlan = scenario.topology.vlans.map(v => (Array.isArray(v.hosts) ? v.hosts : []));
    const vlanXs = layoutVlanRow(hostsPerVlan.map(h => h.length));

    scenario.topology.vlans.forEach((vlanDef, vlanIndex) => {
      const vlanNodeId = generateId();
      const vId = nextVlanId(newNodes);
      const { subnet, gateway } = vId !== undefined ? vlanAddressing(vId) : { subnet: undefined, gateway: undefined };
      const vlanNode: NetworkNode = {
        id: vlanNodeId,
        type: 'vlan',
        name: vlanDef.name,
        scenarioRef: vlanDef.name,
        x: vlanXs[vlanIndex],
        y: 500,
        parentId: ROUTER_ID,
        vlanId: vId,
        subnet,
        gateway
      };
      newNodes.push(vlanNode);
      newConnections.push({ id: `conn-${vlanNodeId}`, fromId: ROUTER_ID, toId: vlanNodeId });

      const hostNames = hostsPerVlan[vlanIndex];
      hostNames.forEach((hostName, hostIndex) => {
        const hostId = generateId();
        const ip = nextHostIp(newNodes, vlanNodeId, vlanNode);
        const offset = hostOffset(hostIndex, hostNames.length);
        newNodes.push({
          id: hostId,
          type: 'host',
          name: hostName,
          scenarioRef: hostName,
          x: vlanNode.x + offset,
          y: vlanNode.y + 150,
          parentId: vlanNodeId,
          ip
        });
        newConnections.push({ id: `conn-${hostId}`, fromId: vlanNodeId, toId: hostId });
      });
    });

    setNodes(newNodes);
    setConnections(newConnections);
    setSelectedNodeId(null);
    setFirewallPolicy('block-all');
    setRules([]);
    setSimulation(null);
    setActiveScenario(scenario);
    setAddressLists([]);
    setPhase(1);
  }, []);

  const clearScenario = useCallback(() => setActiveScenario(null), []);

  return {
    phase,
    setPhase,
    nodes,
    connections,
    selectedNodeId,
    setSelectedNodeId,
    firewallPolicy,
    setFirewallPolicy,
    rules,
    simulation,
    setSimulation,
    addNode,
    updateNode,
    deleteNode,
    addRule,
    deleteRule,
    reorderRules,
    resetNetwork,
    activeScenario,
    loadScenario,
    clearScenario,
    addressLists,
    addAddressList,
    updateAddressList,
    deleteAddressList,
    ROUTER_ID
  };
}
