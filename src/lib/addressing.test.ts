import { describe, it, expect } from 'vitest';
import { nextVlanId, vlanAddressing, nextHostIp, DIRECT_HOST_SUBNET_BASE } from './addressing';
import { NetworkNode } from '@/types/firewall';

const vlanNode = (vlanId: number): NetworkNode => ({
  id: `vlan-${vlanId}`, type: 'vlan', name: `VLAN ${vlanId}`, x: 0, y: 0, parentId: 'router', vlanId, ...vlanAddressing(vlanId)
});
const hostNode = (id: string, ip: string, parentId = 'vlan-10'): NetworkNode => ({
  id, type: 'host', name: id, x: 0, y: 0, parentId, ip
});
const isValidSubnet = (subnet: string) => {
  const octets = subnet.replace('/24', '').split('.').map(Number);
  return octets.length === 4 && octets.every(o => Number.isInteger(o) && o >= 0 && o <= 255);
};

describe('nextVlanId', () => {
  it('starts at 10 and hands out round tens first', () => {
    const ids: number[] = [];
    const nodes: NetworkNode[] = [];
    for (let i = 0; i < 3; i++) {
      const id = nextVlanId(nodes)!;
      ids.push(id);
      nodes.push(vlanNode(id));
    }
    expect(ids).toEqual([10, 20, 30]);
  });

  it('reuses the id of a deleted VLAN', () => {
    expect(nextVlanId([vlanNode(10), vlanNode(30)])).toBe(20);
  });

  it('never produces an invalid subnet, even with many VLANs', () => {
    const nodes: NetworkNode[] = [];
    for (let i = 0; i < 253; i++) {
      const id = nextVlanId(nodes);
      expect(id).toBeDefined();
      expect(id).toBeGreaterThanOrEqual(2);
      expect(id).toBeLessThanOrEqual(254);
      expect(isValidSubnet(vlanAddressing(id!).subnet)).toBe(true);
      nodes.push(vlanNode(id!));
    }
    // 26th VLAN: after 10..250 the remaining ids follow, starting at 2.
    expect(nodes[25].vlanId).toBe(2);
    expect(new Set(nodes.map(n => n.vlanId)).size).toBe(253);
    // All usable ids taken.
    expect(nextVlanId(nodes)).toBeUndefined();
  });
});

describe('nextHostIp', () => {
  const vlan = vlanNode(10);

  it('starts at .10 in the VLAN subnet', () => {
    expect(nextHostIp([vlan], vlan.id, vlan)).toBe('192.168.10.10');
  });

  it('does not hand out a duplicate after a host was deleted', () => {
    // Hosts .10 and .11 existed; .10 was deleted.
    const nodes = [vlan, hostNode('b', '192.168.10.11')];
    expect(nextHostIp(nodes, vlan.id, vlan)).toBe('192.168.10.10');
    // And the next one skips the address that is still in use.
    expect(nextHostIp([...nodes, hostNode('c', '192.168.10.10')], vlan.id, vlan)).toBe('192.168.10.12');
  });

  it('stops at .254 and reports a full segment', () => {
    const hosts = Array.from({ length: 245 }, (_, i) => hostNode(`h${i}`, `192.168.10.${10 + i}`));
    expect(hosts[hosts.length - 1].ip).toBe('192.168.10.254');
    expect(nextHostIp([vlan, ...hosts], vlan.id, vlan)).toBeUndefined();
  });

  it('uses the direct-host segment for hosts on the router', () => {
    const nodes = [hostNode('a', `${DIRECT_HOST_SUBNET_BASE}.10`, 'router')];
    expect(nextHostIp(nodes, 'router', undefined)).toBe(`${DIRECT_HOST_SUBNET_BASE}.11`);
  });
});
