import { describe, it, expect } from 'vitest';
import { checkRules, evaluateConnection } from './firewallEngine';
import { NetworkNode, FirewallRule, AddressList } from '@/types/firewall';

const router: NetworkNode = { id: 'router', type: 'router', name: 'Router', x: 0, y: 0, parentId: null };
const vlan1: NetworkNode = { id: 'vlan1', type: 'vlan', name: 'DATA', x: 0, y: 0, parentId: 'router' };
const vlan2: NetworkNode = { id: 'vlan2', type: 'vlan', name: 'IOT', x: 0, y: 0, parentId: 'router' };
const host1: NetworkNode = { id: 'host1', type: 'host', name: 'Host 1', x: 0, y: 0, parentId: 'vlan1' };
const host2: NetworkNode = { id: 'host2', type: 'host', name: 'Host 2', x: 0, y: 0, parentId: 'vlan2' };

const nodes: NetworkNode[] = [router, vlan1, vlan2, host1, host2];

function rule(overrides: Partial<FirewallRule>): FirewallRule {
  return {
    id: 'r1',
    sourceId: vlan1.id,
    destinationId: vlan2.id,
    connectionStates: ['new'],
    action: 'allow',
    order: 0,
    ...overrides
  };
}

describe('checkRules', () => {
  it('allows a new request that matches an explicit new/allow rule', () => {
    const results = checkRules({
      nodes,
      rules: [rule({})],
      firewallPolicy: 'block-all',
      sourceId: vlan1.id,
      destinationId: vlan2.id,
      isReply: false
    });

    const last = results[results.length - 1];
    expect(last.matched).toBe(true);
    expect(last.action).toBe('allow');
  });

  it('falls back to the default (block-all) policy for the reply when no established/related rule exists', () => {
    // A rule that only allows 'new' must not silently let the reply through:
    // replies are 'established' and need their own rule.
    const results = checkRules({
      nodes,
      rules: [rule({})],
      firewallPolicy: 'block-all',
      sourceId: vlan1.id,
      destinationId: vlan2.id,
      isReply: true
    });

    const last = results[results.length - 1];
    expect(last.matched).toBe(true);
    expect(last.action).toBe('drop');
    expect(last.ruleId).toBe('default');
  });

  it('lets an established/related rule match the reply', () => {
    const results = checkRules({
      nodes,
      rules: [rule({ connectionStates: ['established', 'related'] })],
      firewallPolicy: 'block-all',
      sourceId: vlan1.id,
      destinationId: vlan2.id,
      isReply: true
    });

    const last = results[results.length - 1];
    expect(last.matched).toBe(true);
    expect(last.action).toBe('allow');
  });

  it('recognizes traffic from a host as belonging to its parent VLAN', () => {
    const results = checkRules({
      nodes,
      rules: [rule({})],
      firewallPolicy: 'block-all',
      sourceId: host1.id,
      destinationId: vlan2.id,
      isReply: false
    });

    const last = results[results.length - 1];
    expect(last.matched).toBe(true);
    expect(last.action).toBe('allow');
  });

  it('does not let a "new" rule match in reverse, and reports the direction as the reason', () => {
    const results = checkRules({
      nodes,
      rules: [rule({ sourceId: vlan2.id, destinationId: vlan1.id })], // VLAN2 -> VLAN1, new, allow
      firewallPolicy: 'block-all',
      sourceId: vlan1.id, // packet goes VLAN1 -> VLAN2 (reverse of the rule)
      destinationId: vlan2.id,
      isReply: false
    });

    // The rule itself must not match (wrong direction for 'new' traffic) —
    // it only ends up "allowed" via the block-all fallback's own drop.
    expect(results[0].matched).toBe(false);
    expect(results[0].reason).toContain('verkeerde richting');
    expect(results[results.length - 1].ruleId).toBe('default');
  });

  it('allows the router itself to be a rule destination (opt-in chain input)', () => {
    // The router isn't a required destination — inter-VLAN/host traffic is
    // the default focus — but a rule can optionally target it, e.g. "who
    // may manage the router". No engine changes were needed for this: the
    // router is just another node with a matching id.
    const results = checkRules({
      nodes,
      rules: [rule({ sourceId: host1.id, destinationId: router.id })],
      firewallPolicy: 'block-all',
      sourceId: host1.id,
      destinationId: router.id,
      isReply: false
    });

    const last = results[results.length - 1];
    expect(last.matched).toBe(true);
    expect(last.action).toBe('allow');
  });

  it('matches traffic from a member of an address list used as the rule source', () => {
    const trustedList: AddressList = { id: 'list1', name: 'trusted', memberIds: [host1.id, host2.id] };
    const results = checkRules({
      nodes,
      addressLists: [trustedList],
      rules: [rule({ sourceId: trustedList.id, destinationId: router.id })],
      firewallPolicy: 'block-all',
      sourceId: host2.id, // host2 is a list member, not the VLAN itself
      destinationId: router.id,
      isReply: false
    });

    const last = results[results.length - 1];
    expect(last.matched).toBe(true);
    expect(last.action).toBe('allow');
  });

  it('matches traffic from a host whose parent VLAN is a member of an address list', () => {
    const vlanList: AddressList = { id: 'list2', name: 'internal-vlans', memberIds: [vlan1.id] };
    const results = checkRules({
      nodes,
      addressLists: [vlanList],
      rules: [rule({ sourceId: vlanList.id, destinationId: vlan2.id })],
      firewallPolicy: 'block-all',
      sourceId: host1.id, // host1's parent (vlan1) is the list member
      destinationId: vlan2.id,
      isReply: false
    });

    const last = results[results.length - 1];
    expect(last.matched).toBe(true);
    expect(last.action).toBe('allow');
  });

  it('does not match traffic from a node that is not a member of the address list', () => {
    const trustedList: AddressList = { id: 'list3', name: 'trusted', memberIds: [host1.id] };
    const results = checkRules({
      nodes,
      addressLists: [trustedList],
      rules: [rule({ sourceId: trustedList.id, destinationId: router.id })],
      firewallPolicy: 'block-all',
      sourceId: host2.id, // not a member of the list
      destinationId: router.id,
      isReply: false
    });

    expect(results[0].matched).toBe(false);
    expect(results[results.length - 1].ruleId).toBe('default');
  });

  it('reports a reject action distinctly from drop', () => {
    const results = checkRules({
      nodes,
      rules: [rule({ action: 'reject' })],
      firewallPolicy: 'block-all',
      sourceId: vlan1.id,
      destinationId: vlan2.id,
      isReply: false
    });

    const last = results[results.length - 1];
    expect(last.matched).toBe(true);
    expect(last.action).toBe('reject');
  });

  it('does not let an established rule match a reply in the reverse direction', () => {
    // Rule DATA -> IOT (established); the reply of a DATA -> IOT connection travels IOT -> DATA.
    const results = checkRules({
      nodes,
      rules: [rule({ connectionStates: ['established', 'related'] })],
      firewallPolicy: 'block-all',
      sourceId: vlan2.id,
      destinationId: vlan1.id,
      isReply: true
    });

    expect(results[results.length - 1].ruleId).toBe('default');
    // The trace names the reply packet's real direction and says what is needed.
    expect(results[0].reason).toContain('dit pakket gaat IOT → DATA');
    expect(results[0].reason).toContain('regel IOT → DATA (established) nodig');
  });

  it('lets a rule with ANY match replies in both directions', () => {
    const anyRule = rule({ sourceId: 'ANY', destinationId: 'ANY', connectionStates: ['established', 'related'] });
    for (const [src, dst] of [[vlan1.id, vlan2.id], [vlan2.id, vlan1.id]]) {
      const results = checkRules({ nodes, rules: [anyRule], firewallPolicy: 'block-all', sourceId: src, destinationId: dst, isReply: true });
      expect(results[results.length - 1].action).toBe('allow');
    }
  });

  it('lets packets sent by the router itself through (chain output is not filtered)', () => {
    const results = checkRules({ nodes, rules: [], firewallPolicy: 'block-all', sourceId: router.id, destinationId: vlan1.id, isReply: true });
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe('output-chain');
    expect(results[0].action).toBe('allow');
  });
});

describe('evaluateConnection', () => {
  const base = { nodes, firewallPolicy: 'block-all' as const, sourceId: vlan1.id, destinationId: vlan2.id };

  it('stops at the request when the new packet is blocked', () => {
    const result = evaluateConnection({ ...base, rules: [] });
    expect(result).toMatchObject({ allowed: false, blockedAt: 'request' });
    expect(result.reply).toBeUndefined();
  });

  it('evaluates the reply in the reverse direction', () => {
    const result = evaluateConnection({ ...base, rules: [rule({})] });
    expect(result.blockedAt).toBe('reply');
    expect(result.reply![0].reason).toContain('IOT → DATA');
  });

  it('requires the follow-up packets (established, request direction) as well', () => {
    const replyRule = rule({ id: 'r2', sourceId: vlan2.id, destinationId: vlan1.id, connectionStates: ['established'], order: 1 });
    expect(evaluateConnection({ ...base, rules: [rule({}), replyRule] }).blockedAt).toBe('followUp');

    const bothWays = [rule({ connectionStates: ['new', 'established'] }), replyRule];
    const ok = evaluateConnection({ ...base, rules: bothWays });
    expect(ok.allowed).toBe(true);
    expect(ok.blockedAt).toBeUndefined();
  });

  it('works for management traffic to the router: the reply leaves through chain output', () => {
    const toRouter = rule({ destinationId: router.id, connectionStates: ['new', 'established'] });
    const result = evaluateConnection({ ...base, destinationId: router.id, rules: [toRouter] });
    expect(result.allowed).toBe(true);
    expect(result.reply![0].ruleId).toBe('output-chain');
  });
});
