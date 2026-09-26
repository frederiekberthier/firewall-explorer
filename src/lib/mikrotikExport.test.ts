import { describe, it, expect } from 'vitest';
import { buildMikrotikConfig } from './mikrotikExport';
import { NetworkNode, FirewallRule, FirewallPolicy } from '@/types/firewall';

const nodes: NetworkNode[] = [
  { id: 'router-main', type: 'router', name: 'Router', x: 400, y: 300, parentId: null },
  { id: 'inet', type: 'internet', name: 'Internet', x: 400, y: 80, parentId: 'router-main' },
  { id: 'data', type: 'vlan', name: 'DATA', x: 200, y: 500, parentId: 'router-main', vlanId: 10, subnet: '192.168.10.0/24' }
];

const rules: FirewallRule[] = [
  { id: 'r1', sourceId: 'data', destinationId: 'inet', connectionStates: ['new'], action: 'allow', order: 0 },
  { id: 'r2', sourceId: 'inet', destinationId: 'data', connectionStates: ['established', 'related'], action: 'allow', order: 1 }
];

const exportWith = (firewallPolicy: FirewallPolicy, ruleset: FirewallRule[] = rules) =>
  buildMikrotikConfig({ nodes, rules: ruleset, addressLists: [], firewallPolicy, generatedAt: new Date(2026, 0, 1) });

const WAN_DROP = 'chain=forward in-interface-list=WAN connection-state=new action=drop';
const FORWARD_DROP_ALL = '/ip firewall filter add chain=forward action=drop comment="Simulator: default policy Block All"';
const INPUT_DROP = 'chain=input action=drop';

// Active (not commented-out) filter lines, in order.
const activeFilterLines = (config: string) =>
  config.split('\n').filter(line => line.startsWith('/ip firewall filter add'));

describe('buildMikrotikConfig', () => {
  it('ends the forward chain with a drop-all when the policy is Block All', () => {
    const lines = activeFilterLines(exportWith('block-all'));
    expect(lines[lines.length - 1]).toBe(FORWARD_DROP_ALL);
  });

  it('does not add a drop-all for Allow All, but explains why', () => {
    const config = exportWith('allow-all');
    expect(config).not.toContain(FORWARD_DROP_ALL);
    expect(config).toContain('Default policy Allow All: geen extra regel nodig');
  });

  it('always blocks new WAN -> LAN traffic, for both policies', () => {
    for (const policy of ['block-all', 'allow-all'] as const) {
      expect(activeFilterLines(exportWith(policy)).some(l => l.includes(WAN_DROP))).toBe(true);
    }
  });

  it('puts the explicit rules before the safety nets, so an explicit allow still wins', () => {
    const lines = activeFilterLines(exportWith('block-all'));
    const lastExplicit = lines.findIndex(l => l.includes('comment="Rule 2:'));
    const wanDrop = lines.findIndex(l => l.includes(WAN_DROP));
    const dropAll = lines.indexOf(FORWARD_DROP_ALL);

    expect(lastExplicit).toBeGreaterThanOrEqual(0);
    expect(lastExplicit).toBeLessThan(wanDrop);
    expect(wanDrop).toBeLessThan(dropAll);
  });

  it('only emits the input-chain drop commented out, with a lock-out warning', () => {
    const config = exportWith('block-all');
    const inputLines = config.split('\n').filter(l => l.includes(INPUT_DROP));

    expect(inputLines).toHaveLength(1);
    expect(inputLines[0].startsWith('# ')).toBe(true);
    expect(config).toContain('sluit je jezelf buiten de router');
    expect(activeFilterLines(config).some(l => l.includes('chain=input'))).toBe(false);
  });

  it('still exports the explicit rules and address lists as before', () => {
    const config = exportWith('block-all');
    expect(config).toContain('/ip firewall address-list add list=data address=192.168.10.0/24 comment="DATA (VLAN 10)"');
    expect(config).toContain(
      '/ip firewall filter add chain=forward src-address-list=data dst-address-list=internet connection-state=new action=accept comment="Rule 1: DATA -> Internet (new)"'
    );
  });

  it('includes the safety nets even when there are no explicit rules', () => {
    const lines = activeFilterLines(exportWith('block-all', []));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(WAN_DROP);
    expect(lines[1]).toBe(FORWARD_DROP_ALL);
  });
});
