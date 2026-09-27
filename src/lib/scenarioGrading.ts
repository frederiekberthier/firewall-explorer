import { NetworkNode, FirewallRule, FirewallPolicy, AddressList } from '@/types/firewall';
import { Scenario, ScenarioIntent } from '@/types/scenario';
import { checkRules, evaluateConnection } from './firewallEngine';

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

/**
 * An intent's `from`/`to` is normally an exact node name, but can also be
 * one of these wildcard tokens (same vocabulary as a rule's source/
 * destination in the rule editor) to mean "this must hold for every node of
 * this kind" — e.g. `from: 'ANY_VLAN', to: 'Internet', expect: 'allow'`
 * checks that *each* VLAN individually can reach the internet, without
 * having to write one requirement per VLAN.
 */
export const INTENT_WILDCARD_TOKENS = ['ANY_VLAN', 'ANY_HOST', 'ANY_INTERNET', 'ANY'] as const;
export type IntentWildcardToken = typeof INTENT_WILDCARD_TOKENS[number];

export function isIntentWildcardToken(value: string): value is IntentWildcardToken {
  return (INTENT_WILDCARD_TOKENS as readonly string[]).includes(value);
}

/** Resolves an intent's `from`/`to` to the concrete node(s) it refers to. */
function resolveIntentRef(ref: string, nodes: NetworkNode[]): NetworkNode[] {
  if (!isIntentWildcardToken(ref)) {
    const node = nodes.find(n => n.name === ref);
    return node ? [node] : [];
  }
  switch (ref) {
    case 'ANY_VLAN': return nodes.filter(n => n.type === 'vlan');
    case 'ANY_HOST': return nodes.filter(n => n.type === 'host');
    case 'ANY_INTERNET': return nodes.filter(n => n.type === 'internet');
    case 'ANY': return nodes.filter(n => n.type !== 'router');
  }
}

/**
 * Checks one concrete source/destination pair against the ruleset — the
 * same evaluation engine the simulator itself runs
 * (src/lib/firewallEngine.ts), so "does this ruleset satisfy the
 * requirement" and "what does the simulator show when you test it by hand"
 * can never disagree.
 *
 * When `intent.state` is explicitly set, only that single phase is tested
 * (this is what the scenario wizard always produces, so a requirement can
 * separately say "nieuw verkeer mag" vs. "bestaand verkeer mag" and
 * students learn to reason about the two phases step by step). Without a
 * `state` (older/hand-written scenarios), the original combined behavior is
 * kept: `expect: 'drop'` only checks the request, `expect: 'allow'` checks
 * the whole connection (see evaluateConnection): the request, the reply in
 * the reverse direction and the client's follow-up packets must all get
 * through — a rule that only lets the request in does not satisfy
 * "mag verbinden met".
 */
function checkPair(
  fromNode: NetworkNode,
  toNode: NetworkNode,
  rules: FirewallRule[],
  addressLists: AddressList[],
  firewallPolicy: FirewallPolicy,
  intent: ScenarioIntent,
  nodes: NetworkNode[]
): { pass: boolean; reason: string } {
  const { expect, state } = intent;

  if (state === 'new' || state === 'established') {
    const isReply = state === 'established';
    const result = checkRules({
      nodes,
      rules,
      addressLists,
      firewallPolicy,
      sourceId: fromNode.id,
      destinationId: toNode.id,
      isReply
    });
    const verdict = result[result.length - 1];
    const allowed = verdict.action === 'allow';
    const pass = expect === 'allow' ? allowed : !allowed;
    const label = isReply ? 'Bestaand (established/related) verkeer' : 'Nieuw verkeer';
    return {
      pass,
      reason: pass
        ? verdict.reason
        : expect === 'allow'
          ? `${label} werd geblokkeerd: ${verdict.reason}`
          : `${label} werd onverwacht toegelaten: ${verdict.reason}`
    };
  }

  // No explicit state: the whole connection. A drop intent only needs the
  // request to be blocked; an allow intent needs the request, the reply
  // (reversed direction) and the client's follow-up packets to pass — on a
  // real router the connection breaks if any of the three is dropped.
  const connection = evaluateConnection({
    nodes,
    rules,
    addressLists,
    firewallPolicy,
    sourceId: fromNode.id,
    destinationId: toNode.id
  });
  const requestVerdict = connection.request[connection.request.length - 1];
  const requestAllowed = requestVerdict.action === 'allow';

  if (expect === 'drop') {
    return {
      pass: !requestAllowed,
      reason: requestAllowed
        ? `Verkeer werd onverwacht toegelaten: ${requestVerdict.reason}`
        : requestVerdict.reason
    };
  }

  if (connection.blockedAt === 'request') {
    return { pass: false, reason: `Nieuw verkeer werd geblokkeerd: ${requestVerdict.reason}` };
  }
  if (connection.blockedAt === 'reply') {
    const verdict = connection.reply![connection.reply!.length - 1];
    return {
      pass: false,
      reason: `Verzoek werd toegelaten, maar het antwoord (${toNode.name} → ${fromNode.name}) niet: ${verdict.reason}`
    };
  }
  if (connection.blockedAt === 'followUp') {
    const verdict = connection.followUp![connection.followUp!.length - 1];
    return {
      pass: false,
      reason: `Verzoek en antwoord kwamen door, maar de vervolgpakketten (${fromNode.name} → ${toNode.name}, established) niet: ${verdict.reason}`
    };
  }

  return { pass: true, reason: requestVerdict.reason };
}

export function runIntent(
  intent: ScenarioIntent,
  nodes: NetworkNode[],
  rules: FirewallRule[],
  firewallPolicy: FirewallPolicy,
  addressLists: AddressList[] = []
): IntentResult {
  const fromNodes = resolveIntentRef(intent.from, nodes);
  const toNodes = resolveIntentRef(intent.to, nodes);

  if (fromNodes.length === 0 || toNodes.length === 0) {
    return {
      intent,
      pass: false,
      reason: `Kan "${intent.from}" en/of "${intent.to}" niet terugvinden in het huidige netwerk.`
    };
  }

  const pairs: Array<[NetworkNode, NetworkNode]> = [];
  for (const fromNode of fromNodes) {
    for (const toNode of toNodes) {
      if (fromNode.id !== toNode.id) pairs.push([fromNode, toNode]);
    }
  }

  if (pairs.length === 0) {
    return {
      intent,
      pass: false,
      reason: `"${intent.from}" en "${intent.to}" verwijzen naar hetzelfde netwerk-element.`
    };
  }

  // A wildcard intent (e.g. "ANY_VLAN -> Internet") must hold for *every*
  // matching pair — one failing VLAN means the requirement isn't met yet.
  let lastReason = '';
  for (const [fromNode, toNode] of pairs) {
    const result = checkPair(fromNode, toNode, rules, addressLists, firewallPolicy, intent, nodes);
    if (!result.pass) {
      const prefix = pairs.length > 1 ? `${fromNode.name} → ${toNode.name}: ` : '';
      return { intent, pass: false, reason: prefix + result.reason };
    }
    lastReason = result.reason;
  }

  return {
    intent,
    pass: true,
    reason: pairs.length > 1
      ? `Getest voor ${pairs.length} combinatie(s) (${fromNodes.map(n => n.name).join(', ')} → ${toNodes.map(n => n.name).join(', ')}), telkens in orde.`
      : lastReason
  };
}

/**
 * Static hygiene checks over the ruleset itself, independent of any
 * scenario (a small "linter"). Deliberately conservative: it
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
