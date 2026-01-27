import { useState, useCallback } from 'react';
import { NetworkNode, Connection, FirewallRule, Phase, SimulationPacket } from '@/types/firewall';

const ROUTER_ID = 'router-main';

const initialNodes: NetworkNode[] = [
  { id: ROUTER_ID, type: 'router', name: 'Router', x: 400, y: 300, parentId: null }
];

export function useNetworkState() {
  const [phase, setPhase] = useState<Phase>(1);
  const [nodes, setNodes] = useState<NetworkNode[]>(initialNodes);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [simulation, setSimulation] = useState<SimulationPacket | null>(null);

  const generateId = () => `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addNode = useCallback((type: 'internet' | 'vlan' | 'host') => {
    const newId = generateId();
    let x = 400;
    let y = 100;
    let parentId: string | null = ROUTER_ID;

    if (type === 'internet') {
      y = 80;
      parentId = ROUTER_ID;
    } else if (type === 'vlan') {
      const vlanCount = nodes.filter(n => n.type === 'vlan').length;
      x = 200 + vlanCount * 200;
      y = 500;
      parentId = ROUTER_ID;
    } else if (type === 'host') {
      // Host must be attached to a router or VLAN
      const parentNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
      
      if (parentNode && (parentNode.type === 'router' || parentNode.type === 'vlan')) {
        // Attach to selected router or VLAN
        const existingChildren = nodes.filter(n => n.parentId === selectedNodeId).length;
        // Spread children horizontally around the parent
        const offset = (existingChildren - Math.floor(existingChildren / 2)) * 120;
        x = parentNode.x + offset;
        y = parentNode.y + 150;
        parentId = selectedNodeId;
      } else {
        // Fallback: attach directly to the main router
        const routerNode = nodes.find(n => n.id === ROUTER_ID);
        const existingChildren = nodes.filter(n => n.parentId === ROUTER_ID && n.type === 'host').length;
        x = (routerNode?.x || 400) + 150 + existingChildren * 120;
        y = (routerNode?.y || 300) + 150;
        parentId = ROUTER_ID;
      }
    }

    const newNode: NetworkNode = {
      id: newId,
      type,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${nodes.filter(n => n.type === type).length + 1}`,
      x,
      y,
      parentId
    };

    setNodes(prev => [...prev, newNode]);
    
    if (parentId) {
      setConnections(prev => [...prev, {
        id: `conn-${Date.now()}`,
        fromId: parentId,
        toId: newId
      }]);
    }
  }, [nodes, selectedNodeId]);

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
    if (selectedNodeId && nodesToDelete.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

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
    setRules([]);
    setSimulation(null);
    setPhase(1);
  }, []);

  return {
    phase,
    setPhase,
    nodes,
    connections,
    selectedNodeId,
    setSelectedNodeId,
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
    ROUTER_ID
  };
}
