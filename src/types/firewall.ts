export type NodeType = 'router' | 'internet' | 'vlan' | 'host';

export type FirewallPolicy = 'allow-all' | 'block-all';

export type ConnState = 'new' | 'established' | 'related' | 'invalid' | 'untracked';

export type RuleAction = 'allow' | 'drop' | 'reject';

export interface NetworkNode {
  id: string;
  type: NodeType;
  name: string;
  x: number;
  y: number;
  parentId: string | null;
  /** VLAN only: RouterOS VLAN ID, e.g. 10. */
  vlanId?: number;
  /** VLAN only: the VLAN's subnet in CIDR notation, e.g. "192.168.10.0/24". */
  subnet?: string;
  /** VLAN only: the router's interface address for this VLAN, e.g. "192.168.10.1". */
  gateway?: string;
  /** Host only: the host's IP address within its parent VLAN's subnet. */
  ip?: string;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
}

/** A named group of VLANs/hosts, usable as a rule's source or destination. */
export interface AddressList {
  id: string;
  name: string;
  memberIds: string[];
}

export interface FirewallRule {
  id: string;
  sourceId: string;
  destinationId: string;
  connectionStates: ConnState[];
  action: RuleAction;
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
