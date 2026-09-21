import { NetworkNode } from '@/types/firewall';

// Hosts that hang directly off the router (no VLAN) share this fallback
// segment so they still get a real, exportable address.
export const DIRECT_HOST_SUBNET_BASE = '192.168.0';

/**
 * Next free VLAN id, starting at 10 (not 1) to avoid clashing with the
 * router's native VLAN 1.
 */
export function nextVlanId(existingNodes: NetworkNode[]): number {
  const usedIds = existingNodes.filter(n => n.type === 'vlan').map(n => n.vlanId ?? 0);
  return usedIds.length === 0 ? 10 : Math.max(...usedIds) + 10;
}

/** A real, exportable /24 subnet + router-interface gateway for a VLAN id. */
export function vlanAddressing(vlanId: number): { subnet: string; gateway: string } {
  return { subnet: `192.168.${vlanId}.0/24`, gateway: `192.168.${vlanId}.1` };
}

/**
 * Next free host address in the parent VLAN's subnet (or in the fallback
 * segment for hosts attached straight to the router).
 */
export function nextHostIp(existingNodes: NetworkNode[], parentId: string, parentNode: NetworkNode | undefined): string {
  const siblingHostCount = existingNodes.filter(n => n.type === 'host' && n.parentId === parentId).length;
  const subnetBase = parentNode?.type === 'vlan' && parentNode.subnet
    ? parentNode.subnet.split('.').slice(0, 3).join('.')
    : DIRECT_HOST_SUBNET_BASE;
  return `${subnetBase}.${10 + siblingHostCount}`;
}
