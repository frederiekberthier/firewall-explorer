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
 * names, or "Internet"/"Router").
 *
 * `expect: 'allow'` checks the full round trip (the request AND the reply
 * must both get through) — a rule that only lets the request in without a
 * matching established/related rule does not satisfy "mag naar X".
 */
export interface ScenarioIntent {
  id: string;
  requirementId: string;
  description: string;
  from: string;
  to: string;
  expect: 'allow' | 'drop';
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
