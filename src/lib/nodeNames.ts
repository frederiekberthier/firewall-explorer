import { NetworkNode, AddressList } from '@/types/firewall';

export function getNodeName(nodes: NetworkNode[], id: string, addressLists: AddressList[] = []): string {
  if (id === 'ANY') return 'ANY';
  if (id === 'ANY_VLAN') return 'ANY VLAN';
  if (id === 'ANY_HOST') return 'ANY HOST';
  if (id === 'ANY_INTERNET') return 'ANY INTERNET';
  const node = nodes.find(n => n.id === id);
  if (node) return node.name;
  const list = addressLists.find(l => l.id === id);
  if (list) return list.name;
  return 'Onbekend';
}

/**
 * Names a VLAN/host may not get (compared case-insensitively): the router
 * and Internet nodes, and the labels of the wildcards, which appear in the
 * same dropdowns and rule descriptions.
 */
export const RESERVED_NODE_NAMES = ['router', 'internet', 'any', 'any vlan', 'any host', 'any internet', 'alles', 'alles (any)'];

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Default name for a new node of this type: "Host 3" etc. with the lowest
 * number not in use — counting instead would hand out "Host 2" twice after
 * Host 1 was deleted.
 */
export function nextNodeName(nodes: NetworkNode[], type: NetworkNode['type']): string {
  const label = type.charAt(0).toUpperCase() + type.slice(1);
  for (let n = 1; ; n++) {
    const candidate = `${label} ${n}`;
    if (!nodes.some(node => sameName(node.name, candidate))) return candidate;
  }
}

/**
 * Why `name` is not acceptable for node `nodeId`, or null when it is. Names
 * must be unique (ignoring case) because rules, the export and the scenario
 * self-test all show and look up nodes by name.
 */
export function validateNodeName(nodes: NetworkNode[], nodeId: string, name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'Geef een naam op.';

  const node = nodes.find(n => n.id === nodeId);
  const keepsOwnReservedName = node?.type === 'internet' && sameName(trimmed, 'Internet');
  if (!keepsOwnReservedName && RESERVED_NODE_NAMES.includes(trimmed.toLowerCase())) {
    return `"${trimmed}" is een gereserveerde naam.`;
  }

  const clash = nodes.find(n => n.id !== nodeId && sameName(n.name, trimmed));
  if (clash) return `De naam "${trimmed}" is al in gebruik.`;

  return null;
}
