export type NodeType = 'router' | 'internet' | 'vlan' | 'host';

export type FirewallPolicy = 'allow-all' | 'block-all';

export interface NetworkNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  parentId: string | null;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
}

export interface FirewallRule {
  id: string;
  sourceId: string;
  destinationId: string;
  connectionType: 'new' | 'related';
  action: 'allow' | 'drop';
  order: number;
}

export interface SimulationPacket {
  id: string;
  sourceId: string;
  destinationId: string;
  progress: number;
  direction: 'request' | 'reply';
  status: 'traveling' | 'checking' | 'allowed' | 'dropped';
  activeRuleId?: string;
}

export type Phase = 1 | 2 | 3;
