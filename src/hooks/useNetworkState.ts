import { useState, useCallback } from 'react';
import { NetworkNode, Connection, FirewallRule, Phase, SimulationPacket, FirewallPolicy, AddressList } from '@/types/firewall';
import { Scenario } from '@/types/scenario';
import { nextVlanId, vlanAddressing, nextHostIp } from '@/lib/addressing';
import { layoutVlanRow, hostOffset } from '@/lib/layout';

const ROUTER_ID = 'router-main';

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

  const generateId = () => `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
        ({ subnet, gateway } = vlanAddressing(vlanId));
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
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${prev.filter(n => n.type === type).length + 1}`,
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
      return [...prev, { id: `conn-${Date.now()}`, fromId: parentId, toId: newId }];
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
    setRules(prev => prev.filter(r =>
      !nodesToDelete.has(r.sourceId) && !nodesToDelete.has(r.destinationId)
    ));
    setAddressLists(prev => prev.map(list => ({
      ...list,
      memberIds: list.memberIds.filter(id => !nodesToDelete.has(id))
    })));
    if (selectedNodeId && nodesToDelete.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const addAddressList = useCallback((name: string, memberIds: string[]) => {
    const newList: AddressList = {
      id: `list-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
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
    setRules(prev => {
      const filtered = prev.filter(r => r.sourceId !== id && r.destinationId !== id);
      return filtered.map((r, idx) => ({ ...r, order: idx }));
    });
  }, []);

  const addRule = useCallback((rule: Omit<FirewallRule, 'id' | 'order'>) => {
    const newRule: FirewallRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      order: rules.length
    };
    setRules(prev => [...prev, newRule]);
  }, [rules.length]);

  const deleteRule = useCallback((id: string) => {
    setRules(prev => {
      const filtered = prev.filter(r => r.id !== id);
      return filtered.map((r, idx) => ({ ...r, order: idx }));
    });
  }, []);

  const reorderRules = useCallback((startIndex: number, endIndex: number) => {
    setRules(prev => {
      const result = [...prev];
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
      newNodes.push({ id: internetId, type: 'internet', name: 'Internet', x: 400, y: 80, parentId: ROUTER_ID });
      newConnections.push({ id: `conn-${internetId}`, fromId: ROUTER_ID, toId: internetId });
    }

    const hostsPerVlan = scenario.topology.vlans.map(v => (Array.isArray(v.hosts) ? v.hosts : []));
    const vlanXs = layoutVlanRow(hostsPerVlan.map(h => h.length));

    scenario.topology.vlans.forEach((vlanDef, vlanIndex) => {
      const vlanNodeId = generateId();
      const vId = nextVlanId(newNodes);
      const { subnet, gateway } = vlanAddressing(vId);
      const vlanNode: NetworkNode = {
        id: vlanNodeId,
        type: 'vlan',
        name: vlanDef.name,
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
