import { NetworkNode } from '@/types/firewall';

// Hosts that hang directly off the router (no VLAN) share this fallback
// segment so they still get a real, exportable address.
export const DIRECT_HOST_SUBNET_BASE = '192.168.0';

/**
 * The VLAN id doubles as the third octet of its subnet (VLAN 10 ->
 * 192.168.10.0/24), which keeps the addressing easy to read for students.
 * That only works for ids 2-254: 0 is the direct-host segment above and 1 is
 * the router's native VLAN. Round tens (10, 20, ..., 250) are handed out
 * first, then the remaining ids, always the lowest free one — so the id of a
 * deleted VLAN is reused instead of the numbers running off the end.
 */
const VLAN_ID_CANDIDATES: number[] = [
  ...Array.from({ length: 25 }, (_, i) => (i + 1) * 10),
  ...Array.from({ length: 253 }, (_, i) => i + 2).filter(id => id % 10 !== 0)
];

/** Lowest free VLAN id, or undefined when all 253 usable ids are taken. */
export function nextVlanId(existingNodes: NetworkNode[]): number | undefined {
  const usedIds = new Set(existingNodes.filter(n => n.type === 'vlan').map(n => n.vlanId));
  return VLAN_ID_CANDIDATES.find(id => !usedIds.has(id));
}

/** A real, exportable /24 subnet + router-interface gateway for a VLAN id. */
export function vlanAddressing(vlanId: number): { subnet: string; gateway: string } {
  return { subnet: `192.168.${vlanId}.0/24`, gateway: `192.168.${vlanId}.1` };
}

/** Host addresses start at .10 (.1 is the gateway) and end at .254 (.255 is broadcast). */
const FIRST_HOST_OCTET = 10;
const LAST_HOST_OCTET = 254;

/**
 * Lowest free host address in the parent VLAN's subnet (or in the fallback
 * segment for hosts attached straight to the router). Looks at the addresses
 * actually in use, not at a count, so deleting a host never leads to a
 * duplicate. Returns undefined when the segment is full.
 */
export function nextHostIp(existingNodes: NetworkNode[], parentId: string, parentNode: NetworkNode | undefined): string | undefined {
  const subnetBase = parentNode?.type === 'vlan' && parentNode.subnet
    ? parentNode.subnet.split('.').slice(0, 3).join('.')
    : DIRECT_HOST_SUBNET_BASE;

  const usedOctets = new Set(
    existingNodes
      .filter(n => n.type === 'host' && n.ip?.startsWith(`${subnetBase}.`))
      .map(n => Number(n.ip!.split('.')[3]))
  );

  for (let octet = FIRST_HOST_OCTET; octet <= LAST_HOST_OCTET; octet++) {
    if (!usedOctets.has(octet)) return `${subnetBase}.${octet}`;
  }
  return undefined;
}
