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
