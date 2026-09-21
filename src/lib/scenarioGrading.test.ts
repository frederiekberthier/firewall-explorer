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

    // Only a 'new' rule, no established/related -> must fail (this is the F1 lesson)
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
