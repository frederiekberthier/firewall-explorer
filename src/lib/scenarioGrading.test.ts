import { describe, it, expect } from 'vitest';
import { runIntent, lintRules, gradeScenario } from './scenarioGrading';
import { NetworkNode, FirewallRule } from '@/types/firewall';
import { SCENARIOS } from '@/data/scenarios';

const router: NetworkNode = { id: 'router', type: 'router', name: 'Router', x: 0, y: 0, parentId: null };
const internet: NetworkNode = { id: 'internet', type: 'internet', name: 'Internet', x: 0, y: 0, parentId: 'router' };
const data: NetworkNode = { id: 'data', type: 'vlan', name: 'DATA', x: 0, y: 0, parentId: 'router', vlanId: 10, subnet: '192.168.10.0/24', gateway: '192.168.10.1' };
const sec: NetworkNode = { id: 'sec', type: 'vlan', name: 'SEC', x: 0, y: 0, parentId: 'router', vlanId: 20, subnet: '192.168.20.0/24', gateway: '192.168.20.1' };

const nodes: NetworkNode[] = [router, internet, data, sec];

function rule(overrides: Partial<FirewallRule>): FirewallRule {
  return {
    id: 'r',
    sourceId: data.id,
    destinationId: internet.id,
    connectionStates: ['new'],
    action: 'allow',
    order: 0,
    ...overrides
  };
}

describe('runIntent', () => {
  it('passes an allow intent only when both request and reply succeed', () => {
    const intent = SCENARIOS[0].intents!.find(i => i.id === 'i1')!; // DATA -> Internet, expect allow

    // Only a 'new' rule, no established/related -> the reply is dropped, so it must fail
    const onlyNewRule: FirewallRule[] = [rule({ id: 'r1', order: 0 })];
    expect(runIntent(intent, nodes, onlyNewRule, 'block-all').pass).toBe(false);

    const withReplyRule: FirewallRule[] = [
      ...onlyNewRule,
      rule({ id: 'r2', connectionStates: ['established', 'related'], order: 1 })
    ];
    expect(runIntent(intent, nodes, withReplyRule, 'block-all').pass).toBe(true);
  });

  it('passes a drop intent when the default policy already blocks it', () => {
    const intent = SCENARIOS[0].intents!.find(i => i.id === 'i3')!; // DATA -> SEC, expect drop
    expect(runIntent(intent, nodes, [], 'block-all').pass).toBe(true);
  });

  it('fails a drop intent when a rule wrongly allows it', () => {
    const intent = SCENARIOS[0].intents!.find(i => i.id === 'i3')!; // DATA -> SEC, expect drop
    const rules: FirewallRule[] = [rule({ id: 'r1', destinationId: sec.id, order: 0 })];
    expect(runIntent(intent, nodes, rules, 'block-all').pass).toBe(false);
  });
});

describe('lintRules', () => {
  it('flags a rule shadowed by an earlier, identical rule', () => {
    const rules: FirewallRule[] = [
      rule({ id: 'r1', order: 0 }),
      rule({ id: 'r2', order: 1 }) // same source/dest/states as r1, placed after -> dead
    ];
    const findings = lintRules(rules);
    expect(findings.some(f => f.id === 'dead-rule-r2')).toBe(true);
  });

  it('does not flag rules for different source/destination pairs', () => {
    const rules: FirewallRule[] = [
      rule({ id: 'r1', order: 0 }),
      rule({ id: 'r2', destinationId: sec.id, order: 1 })
    ];
    expect(lintRules(rules)).toHaveLength(0 + 1); // only the missing-invalid-drop suggestion
    expect(lintRules(rules).some(f => f.severity === 'warning')).toBe(false);
  });

  it('suggests an invalid-drop rule when none exists', () => {
    const findings = lintRules([rule({ id: 'r1' })]);
    expect(findings.some(f => f.id === 'missing-invalid-drop')).toBe(true);
  });

  it('does not suggest invalid-drop when one already exists', () => {
    const findings = lintRules([
      rule({ id: 'r1' }),
      rule({ id: 'r2', connectionStates: ['invalid'], action: 'drop', order: 1 })
    ]);
    expect(findings.some(f => f.id === 'missing-invalid-drop')).toBe(false);
  });
});

describe('runIntent wildcards', () => {
  it('passes an ANY_VLAN intent only when every VLAN individually satisfies it', () => {
    const intent = { id: 'w1', requirementId: 'R1', description: '', from: 'ANY_VLAN', to: 'Internet', expect: 'allow' as const };

    // Only DATA has a working rule (with reply) — SEC has none.
    const rules: FirewallRule[] = [
      rule({ id: 'r1', sourceId: data.id, destinationId: internet.id, connectionStates: ['new'], order: 0 }),
      rule({ id: 'r2', sourceId: data.id, destinationId: internet.id, connectionStates: ['established', 'related'], order: 1 })
    ];

    const failing = runIntent(intent, nodes, rules, 'block-all');
    expect(failing.pass).toBe(false);
    expect(failing.reason).toContain('SEC');

    const rulesForBoth: FirewallRule[] = [
      ...rules,
      rule({ id: 'r3', sourceId: sec.id, destinationId: internet.id, connectionStates: ['new'], order: 2 }),
      rule({ id: 'r4', sourceId: sec.id, destinationId: internet.id, connectionStates: ['established', 'related'], order: 3 })
    ];
    const passing = runIntent(intent, nodes, rulesForBoth, 'block-all');
    expect(passing.pass).toBe(true);
  });

  it('fails an ANY_VLAN drop intent when even one VLAN is wrongly allowed', () => {
    const intent = { id: 'w2', requirementId: 'R1', description: '', from: 'ANY_VLAN', to: 'SEC', expect: 'drop' as const };
    const rules: FirewallRule[] = [rule({ id: 'r1', sourceId: data.id, destinationId: sec.id, order: 0 })];

    const result = runIntent(intent, nodes, rules, 'block-all');
    expect(result.pass).toBe(false);
  });

  it('reports "no matching nodes" when a wildcard has nothing to expand to', () => {
    const intent = { id: 'w3', requirementId: 'R1', description: '', from: 'ANY_HOST', to: 'Internet', expect: 'allow' as const };
    // `nodes` has no host-type node at all.
    const result = runIntent(intent, nodes, [], 'block-all');
    expect(result.pass).toBe(false);
  });
});

describe('runIntent with an explicit state', () => {
  it('passes a state:"new" intent even without an established/related rule', () => {
    const intent = { id: 'n1', requirementId: 'R1', description: '', from: 'DATA', to: 'Internet', expect: 'allow' as const, state: 'new' as const };
    const rules: FirewallRule[] = [rule({ id: 'r1', connectionStates: ['new'] })];

    const result = runIntent(intent, nodes, rules, 'block-all');
    expect(result.pass).toBe(true);
  });

  it('fails a state:"established" intent when there is only a new-traffic rule', () => {
    const intent = { id: 'e1', requirementId: 'R1', description: '', from: 'DATA', to: 'Internet', expect: 'allow' as const, state: 'established' as const };
    const rules: FirewallRule[] = [rule({ id: 'r1', connectionStates: ['new'] })];

    const result = runIntent(intent, nodes, rules, 'block-all');
    expect(result.pass).toBe(false);
  });

  it('passes a state:"established" intent when a matching established/related rule exists, even without testing "new" separately', () => {
    const intent = { id: 'e2', requirementId: 'R1', description: '', from: 'DATA', to: 'Internet', expect: 'allow' as const, state: 'established' as const };
    const rules: FirewallRule[] = [rule({ id: 'r1', connectionStates: ['established', 'related'] })];

    const result = runIntent(intent, nodes, rules, 'block-all');
    expect(result.pass).toBe(true);
  });

  it('a legacy intent without any state still requires the full round trip', () => {
    const intent = { id: 'l1', requirementId: 'R1', description: '', from: 'DATA', to: 'Internet', expect: 'allow' as const };
    const rules: FirewallRule[] = [rule({ id: 'r1', connectionStates: ['new'] })];

    const result = runIntent(intent, nodes, rules, 'block-all');
    expect(result.pass).toBe(false);
  });
});

describe('gradeScenario', () => {
  it('reports all intents and lint findings together', () => {
    const report = gradeScenario(SCENARIOS[0], nodes, [], 'block-all');
    expect(report.intentResults).toHaveLength(4);
    // R1 (DATA -> Internet, expect allow) fails: block-all with no rules at all
    expect(report.intentResults.find(r => r.intent.id === 'i1')?.pass).toBe(false);
    // R2/R3/R4 (expect drop) pass by default under block-all
    expect(report.intentResults.filter(r => r.intent.id !== 'i1').every(r => r.pass)).toBe(true);
  });
});
