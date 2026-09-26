import { describe, it, expect } from 'vitest';
import { buildMikrotikConfig, sanitizeListName, escapeRouterOsString } from './mikrotikExport';
import { NetworkNode, FirewallRule, FirewallPolicy, AddressList } from '@/types/firewall';

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

  it('exports VLANs as address lists and Internet as the WAN interface list', () => {
    const config = exportWith('block-all');
    expect(config).toContain('/ip firewall address-list add list=data address=192.168.10.0/24 comment="DATA (VLAN 10)"');
    expect(config).toContain(
      '/ip firewall filter add chain=forward src-address-list=data out-interface-list=WAN connection-state=new action=accept comment="Rule 1: DATA -> Internet (new)"'
    );
    expect(config).toContain(
      '/ip firewall filter add chain=forward in-interface-list=WAN dst-address-list=data connection-state=established,related action=accept comment="Rule 2: Internet -> DATA (established,related)"'
    );
  });

  it('includes the safety nets even when there are no explicit rules', () => {
    const lines = activeFilterLines(exportWith('block-all', []));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain(WAN_DROP);
    expect(lines[1]).toBe(FORWARD_DROP_ALL);
  });

  it('never exports Internet as 0.0.0.0/0, which would also match internal subnets', () => {
    // "DATA -> Internet" must not turn into "DATA -> everything" (incl. DATA -> SEC).
    const config = exportWith('block-all');
    expect(config).not.toContain('0.0.0.0/0');
    expect(config).not.toContain('address-list=internet');
  });
});

describe('buildMikrotikConfig wildcards', () => {
  const vlanNodes: NetworkNode[] = [
    ...nodes,
    { id: 'sec', type: 'vlan', name: 'SEC', x: 600, y: 500, parentId: 'router-main', vlanId: 20, subnet: '192.168.20.0/24' },
    { id: 'pc1', type: 'host', name: 'PC 1', x: 200, y: 650, parentId: 'data', ip: '192.168.10.10' }
  ];
  const exportRules = (ruleset: FirewallRule[], lists: AddressList[] = []) =>
    buildMikrotikConfig({ nodes: vlanNodes, rules: ruleset, addressLists: lists, firewallPolicy: 'block-all', generatedAt: new Date(2026, 0, 1) });
  const ruleLine = (config: string) => activeFilterLines(config).find(l => l.includes('comment="Rule 1:'))!;

  it('restricts ANY VLAN to an address list with every VLAN subnet', () => {
    const config = exportRules([
      { id: 'r1', sourceId: 'ANY_VLAN', destinationId: 'inet', connectionStates: ['new'], action: 'allow', order: 0 }
    ]);
    expect(ruleLine(config)).toContain('src-address-list=any_vlan out-interface-list=WAN');
    expect(config).toContain('list=any_vlan address=192.168.10.0/24');
    expect(config).toContain('list=any_vlan address=192.168.20.0/24');
  });

  it('gives ANY VLAN -> ANY VLAN a source and a destination instead of matching everything', () => {
    const config = exportRules([
      { id: 'r1', sourceId: 'ANY_VLAN', destinationId: 'ANY_VLAN', connectionStates: ['new'], action: 'allow', order: 0 }
    ]);
    expect(ruleLine(config)).toContain('src-address-list=any_vlan dst-address-list=any_vlan');
    // The list is defined once, not once per side.
    expect(config.match(/list=any_vlan address=192\.168\.10\.0\/24/g)).toHaveLength(1);
  });

  it('exports ANY without restriction, e.g. the global "accept established,related" rule', () => {
    const config = exportRules([
      { id: 'r1', sourceId: 'ANY', destinationId: 'ANY', connectionStates: ['established', 'related'], action: 'allow', order: 0 }
    ]);
    expect(ruleLine(config)).toMatch(/^\/ip firewall filter add chain=forward connection-state=established,related action=accept /);
  });

  it('gives clashing names distinct RouterOS lists instead of merging them', () => {
    const lists: AddressList[] = [{ id: 'l1', name: 'data', memberIds: ['sec'] }];
    const config = exportRules([
      { id: 'r1', sourceId: 'data', destinationId: 'inet', connectionStates: ['new'], action: 'allow', order: 0 },
      { id: 'r2', sourceId: 'l1', destinationId: 'inet', connectionStates: ['new'], action: 'drop', order: 1 }
    ], lists);
    expect(config).toContain('list=data address=192.168.10.0/24');
    expect(config).toContain('list=data_2 address=192.168.20.0/24');
    expect(config).toContain('src-address-list=data_2 out-interface-list=WAN connection-state=new action=drop');
  });

  it('keeps names with quotes or $ from breaking the generated commands', () => {
    const weirdNodes = vlanNodes.map(n => (n.id === 'pc1' ? { ...n, name: 'PC "Jan" $1/2' } : n));
    const config = buildMikrotikConfig({
      nodes: weirdNodes,
      rules: [{ id: 'r1', sourceId: 'pc1', destinationId: 'inet', connectionStates: ['new'], action: 'allow', order: 0 }],
      addressLists: [],
      firewallPolicy: 'block-all',
      generatedAt: new Date(2026, 0, 1)
    });
    expect(config).toContain('/ip firewall address-list add list=pc_jan_12 address=192.168.10.10 comment="PC \\"Jan\\" \\$1/2"');
    expect(config).toContain('src-address-list=pc_jan_12');
  });
});

describe('name helpers', () => {
  it('sanitizeListName keeps only characters RouterOS accepts in a list name', () => {
    expect(sanitizeListName('Trusted Devices')).toBe('trusted_devices');
    expect(sanitizeListName('  "Lab" / 2 ')).toBe('lab_2');
    expect(sanitizeListName('???')).toBe('lijst');
  });

  it('escapeRouterOsString escapes backslash, double quote and $', () => {
    expect(escapeRouterOsString('a\\b "c" $d')).toBe('a\\\\b \\"c\\" \\$d');
  });
});
