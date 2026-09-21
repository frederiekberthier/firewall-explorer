import { NetworkNode, FirewallRule, FirewallPolicy, AddressList } from '@/types/firewall';
import { Scenario, ScenarioIntent } from '@/types/scenario';
import { checkRules } from './firewallEngine';

export interface IntentResult {
  intent: ScenarioIntent;
  pass: boolean;
  reason: string;
}

export type LintSeverity = 'warning' | 'suggestion';

export interface LintFinding {
  id: string;
  severity: LintSeverity;
  message: string;
  ruleIds?: string[];
}

export interface ScenarioReport {
  intentResults: IntentResult[];
  lintFindings: LintFinding[];
}

function findNodeByName(nodes: NetworkNode[], name: string): NetworkNode | undefined {
  return nodes.find(n => n.name === name);
}

/**
 * Checks one intent against the current topology/ruleset — pure, reuses the
 * same evaluation engine the simulator itself runs (src/lib/firewallEngine.ts),
 * so "does this ruleset satisfy the requirement" and "what does the
 * simulator show when you test it by hand" can never disagree.
 */
export function runIntent(
  intent: ScenarioIntent,
  nodes: NetworkNode[],
  rules: FirewallRule[],
  firewallPolicy: FirewallPolicy,
  addressLists: AddressList[] = []
): IntentResult {
  const fromNode = findNodeByName(nodes, intent.from);
  const toNode = findNodeByName(nodes, intent.to);

  if (!fromNode || !toNode) {
    return {
      intent,
      pass: false,
      reason: `Kan "${intent.from}" en/of "${intent.to}" niet terugvinden in het huidige netwerk.`
    };
  }

  const forward = checkRules({
    nodes,
    rules,
    addressLists,
    firewallPolicy,
    sourceId: fromNode.id,
    destinationId: toNode.id,
    isReply: false
  });
  const forwardVerdict = forward[forward.length - 1];
  const forwardAllowed = forwardVerdict.action === 'allow';

  if (intent.expect === 'drop') {
    return {
      intent,
      pass: !forwardAllowed,
      reason: forwardAllowed
        ? `Verkeer werd onverwacht toegelaten: ${forwardVerdict.reason}`
        : forwardVerdict.reason
    };
  }

  // expect === 'allow': the request must get through AND come back
  // (established/related) — this is the exact behavior F1 used to get wrong.
  if (!forwardAllowed) {
    return {
      intent,
      pass: false,
      reason: `Nieuw verkeer werd geblokkeerd: ${forwardVerdict.reason}`
    };
  }

  const reply = checkRules({
    nodes,
    rules,
    addressLists,
    firewallPolicy,
    sourceId: fromNode.id,
    destinationId: toNode.id,
    isReply: true
  });
  const replyVerdict = reply[reply.length - 1];
  const replyAllowed = replyVerdict.action === 'allow';

  return {
    intent,
    pass: replyAllowed,
    reason: replyAllowed
      ? forwardVerdict.reason
      : `Verzoek werd toegelaten, maar het antwoord niet: ${replyVerdict.reason}`
  };
}

/**
 * Static hygiene checks over the ruleset itself, independent of any
 * scenario — the "linter" from the brief. Deliberately conservative: it
 * only flags rules that are unambiguously dead (identical source/destination
 * to an earlier, at-least-as-broad rule), not every wildcard-subsumption case.
 */
export function lintRules(rules: FirewallRule[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const sorted = [...rules].sort((a, b) => a.order - b.order);

  for (let i = 1; i < sorted.length; i++) {
    const rule = sorted[i];
    const shadowedBy = sorted.slice(0, i).find(earlier =>
      earlier.sourceId === rule.sourceId &&
      earlier.destinationId === rule.destinationId &&
      rule.connectionStates.every(s => earlier.connectionStates.includes(s))
    );
    if (shadowedBy) {
      findings.push({
        id: `dead-rule-${rule.id}`,
        severity: 'warning',
        message: `Regel voor dezelfde bron/bestemming/connection state(s) staat al hoger in de lijst — deze regel wordt nooit bereikt ("eerste match wint").`,
        ruleIds: [shadowedBy.id, rule.id]
      });
    }
  }

  if (rules.length > 0 && !rules.some(r => r.connectionStates.includes('invalid') && r.action !== 'allow')) {
    findings.push({
      id: 'missing-invalid-drop',
      severity: 'suggestion',
      message: 'Geen regel die "invalid" verkeer weigert — op een echte RouterOS-firewall is dit een standaard hygiëneregel.'
    });
  }

  return findings;
}

export function gradeScenario(
  scenario: Scenario,
  nodes: NetworkNode[],
  rules: FirewallRule[],
  firewallPolicy: FirewallPolicy,
  addressLists: AddressList[] = []
): ScenarioReport {
  const intents = Array.isArray(scenario.intents) ? scenario.intents : [];
  const intentResults = intents.map(intent =>
    runIntent(intent, nodes, rules, firewallPolicy, addressLists)
  );

  return {
    intentResults,
    lintFindings: lintRules(rules)
  };
}
