export interface ScenarioRequirement {
  id: string;
  text: string;
}

export interface ScenarioVlan {
  name: string;
  /** Host names to pre-populate this VLAN with. */
  hosts?: string[];
}

export interface ScenarioTopology {
  /** Whether the scenario starts with an Internet node attached to the router. */
  internet?: boolean;
  vlans: ScenarioVlan[];
}

/**
 * A machine-checkable behavior test tied to one requirement: "traffic
 * initiated from `from` to `to` should end up allowed / dropped". Node
 * names are resolved against the loaded topology at check time (VLAN/host
 * names, or "Internet"/"Router") — or one of the wildcard tokens
 * `'ANY_VLAN' | 'ANY_HOST' | 'ANY_INTERNET' | 'ANY'` (see
 * `src/lib/scenarioGrading.ts`), which expands to *every* matching node and
 * requires the check to pass for each one individually.
 *
 * `state` picks which phase of the connection this intent tests:
 * - `'new'` (default when omitted): only the initial request.
 * - `'established'`: only the return traffic (established/related) — lets a
 *   scenario test "a new connection" and "the reply to it" as two separate,
 *   explicit requirements instead of bundling both into one check, so
 *   students learn to reason about the two phases step by step.
 *
 * For backward compatibility, an intent with no `state` at all (e.g. an
 * older hand-written scenario) keeps the original combined behavior:
 * `expect: 'allow'` checks the full round trip (request AND reply must both
 * get through), `expect: 'drop'` checks only the request.
 */
export interface ScenarioIntent {
  id: string;
  requirementId: string;
  description: string;
  from: string;
  to: string;
  expect: 'allow' | 'drop';
  state?: 'new' | 'established';
}

export interface Scenario {
  meta: {
    id: string;
    title: string;
    difficulty?: 'basis' | 'gevorderd';
  };
  brief: {
    markdown: string;
    requirements: ScenarioRequirement[];
  };
  topology: ScenarioTopology;
  /** Optional: without intents, the self-test just can't check anything automatically. */
  intents?: ScenarioIntent[];
}
