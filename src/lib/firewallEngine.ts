import { NetworkNode, FirewallRule, FirewallPolicy, ConnState, RuleAction, AddressList } from '@/types/firewall';
import { getNodeName } from './nodeNames';

export interface RuleCheckResult {
  ruleId: string;
  ruleNumber?: number;
  matched: boolean;
  action: RuleAction | 'continue';
  reason: string;
}

export interface CheckRulesInput {
  nodes: NetworkNode[];
  rules: FirewallRule[];
  /** Named groups of VLANs/hosts a rule's source/destination may reference. */
  addressLists?: AddressList[];
  firewallPolicy: FirewallPolicy;
  sourceId: string;
  destinationId: string;
  isReply: boolean;
}

/**
 * Does `ruleNodeId` (an exact node, an ANY_* wildcard, a VLAN, or an address
 * list) cover the node `packetNodeId` belongs to? A rule aimed at a VLAN (or
 * at an address list containing that VLAN) also covers every host directly
 * attached to it — otherwise a "DATA -> IOT" rule would never recognize
 * traffic from "Host 1" even though it lives inside DATA.
 */
export function matchesWildcard(
  nodes: NetworkNode[],
  ruleNodeId: string,
  packetNodeId: string,
  addressLists: AddressList[] = []
): boolean {
  if (ruleNodeId === packetNodeId) return true;
  if (ruleNodeId === 'ANY') return true;

  const packetNode = nodes.find(n => n.id === packetNodeId);
  if (!packetNode) return false;

  const packetParent = packetNode.parentId ? nodes.find(n => n.id === packetNode.parentId) : undefined;

  if (ruleNodeId === 'ANY_VLAN' && (packetNode.type === 'vlan' || packetParent?.type === 'vlan')) return true;
  if (ruleNodeId === 'ANY_HOST' && packetNode.type === 'host') return true;
  if (ruleNodeId === 'ANY_INTERNET' && packetNode.type === 'internet') return true;

  const ruleNode = nodes.find(n => n.id === ruleNodeId);
  if (ruleNode?.type === 'vlan' && packetNode.type === 'host' && packetNode.parentId === ruleNodeId) {
    return true;
  }

  const list = addressLists.find(l => l.id === ruleNodeId);
  if (list) {
    if (list.memberIds.includes(packetNodeId)) return true;
    if (packetParent && list.memberIds.includes(packetParent.id)) return true;
  }

  return false;
}

/**
 * Pure rule-evaluation engine: given a topology, a ruleset, the default
 * policy and one packet (source, destination, whether it's reply traffic),
 * returns the top-to-bottom evaluation trace, first match wins. No React,
 * no side effects — safe to call from tests or a future batch grader.
 */
export function checkRules({
  nodes,
  rules,
  addressLists = [],
  firewallPolicy,
  sourceId,
  destinationId,
  isReply
}: CheckRulesInput): RuleCheckResult[] {
  const results: RuleCheckResult[] = [];
  const srcId = sourceId;
  const dstId = destinationId;

  const sourceNode = nodes.find(n => n.id === srcId);
  const destNode = nodes.find(n => n.id === dstId);
  const packetState: ConnState = isReply ? 'established' : 'new';
  const packetSrcName = getNodeName(nodes, srcId, addressLists);
  const packetDstName = getNodeName(nodes, dstId, addressLists);

  // Rules are evaluated top to bottom, first match wins — never mutate the
  // caller's array in place (F7), work on a sorted copy instead.
  const sortedRules = [...rules].sort((a, b) => a.order - b.order);

  for (let i = 0; i < sortedRules.length; i++) {
    const rule = sortedRules[i];
    const ruleNumber = i + 1;
    const srcName = getNodeName(nodes, rule.sourceId, addressLists);
    const dstName = getNodeName(nodes, rule.destinationId, addressLists);

    // Check if rule matches this packet (with wildcard support), per field
    const directSrcMatch = matchesWildcard(nodes, rule.sourceId, srcId, addressLists);
    const directDstMatch = matchesWildcard(nodes, rule.destinationId, dstId, addressLists);
    const reverseSrcMatch = matchesWildcard(nodes, rule.sourceId, dstId, addressLists);
    const reverseDstMatch = matchesWildcard(nodes, rule.destinationId, srcId, addressLists);
    const directMatch = directSrcMatch && directDstMatch;
    const reverseMatch = reverseSrcMatch && reverseDstMatch;

    // A fresh (new) request must match the rule's exact configured direction.
    // Only established/related return traffic is allowed to match in reverse.
    const directionOk = directMatch || (isReply && reverseMatch);

    if (!directionOk) {
      // Derive the reason from the first criterion that actually fails, in
      // order: richting (direction) -> bron -> bestemming.
      if (reverseMatch && !isReply) {
        results.push({
          ruleId: rule.id,
          ruleNumber,
          matched: false,
          action: 'continue',
          reason: `Regel ${ruleNumber} (${srcName} → ${dstName}): verkeerde richting — deze regel geldt enkel voor nieuw verkeer ${srcName} → ${dstName}, dit pakket gaat ${packetSrcName} → ${packetDstName}. Ga verder...`
        });
      } else if (!directSrcMatch) {
        results.push({
          ruleId: rule.id,
          ruleNumber,
          matched: false,
          action: 'continue',
          reason: `Regel ${ruleNumber} (${srcName} → ${dstName}): bron komt niet overeen (regel verwacht ${srcName}, pakket komt van ${packetSrcName}). Ga verder...`
        });
      } else {
        results.push({
          ruleId: rule.id,
          ruleNumber,
          matched: false,
          action: 'continue',
          reason: `Regel ${ruleNumber} (${srcName} → ${dstName}): bestemming komt niet overeen (regel verwacht ${dstName}, pakket gaat naar ${packetDstName}). Ga verder...`
        });
      }
      continue;
    }

    // Direction is fine — now check the connection state. established and
    // related are commonly grouped for return traffic (RouterOS convention).
    const stateOk = rule.connectionStates.includes(packetState) ||
      (packetState === 'established' && rule.connectionStates.includes('related'));

    if (!stateOk) {
      results.push({
        ruleId: rule.id,
        ruleNumber,
        matched: false,
        action: 'continue',
        reason: `Regel ${ruleNumber} (${srcName} → ${dstName}): connection state komt niet overeen (regel: ${rule.connectionStates.join(',')}, pakket: ${packetState}). Ga verder...`
      });
      continue;
    }

    results.push({
      ruleId: rule.id,
      ruleNumber,
      matched: true,
      action: rule.action,
      reason: `Regel ${ruleNumber} matcht: ${srcName} → ${dstName} (${rule.connectionStates.join(',')}) → ${rule.action.toUpperCase()}`
    });
    break;
  }

  // If no rule matched, check security rules before applying default policy
  if (results.length === 0 || results.every(r => !r.matched)) {
    // Security rule: Block new connections from internet to internal networks (VLAN/host)
    // unless explicitly allowed by a rule
    if (!isReply && sourceNode?.type === 'internet' &&
      (destNode?.type === 'vlan' || destNode?.type === 'host')) {
      results.push({
        ruleId: 'security-internet-block',
        matched: true,
        action: 'drop',
        reason: `SECURITY: Nieuw verkeer van Internet naar interne netwerken is standaard GEBLOKKEERD (geen expliciete allow regel gevonden)`
      });
    } else {
      // Apply default policy
      const defaultAction = firewallPolicy === 'allow-all' ? 'allow' : 'drop';
      const policyName = firewallPolicy === 'allow-all' ? 'ALLOW (default allow)' : 'DENY (default deny)';
      results.push({
        ruleId: 'default',
        matched: true,
        action: defaultAction,
        reason: `Geen matchende regel gevonden. Default policy: ${policyName}`
      });
    }
  }

  return results;
}
