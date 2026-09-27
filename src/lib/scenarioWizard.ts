import { Scenario, ScenarioRequirement, ScenarioIntent } from '@/types/scenario';
import { SCENARIOS } from '@/data/scenarios';
import { RESERVED_NODE_NAMES } from './nodeNames';

export interface WizardRequirement {
  /** Stable id for React keys / intentChoices lookup — NOT the final "R#". */
  key: string;
  text: string;
}

export interface WizardVlan {
  /** Stable id for React keys and per-VLAN UI state — not part of the scenario. */
  key: string;
  name: string;
  hosts: string[];
}

export interface WizardIntentChoice {
  from: string;
  to: string;
  expect: 'allow' | 'drop';
  /** 'new' (een verbinding starten) of 'established' (bestaand/terugkerend verkeer). Defaults to 'new' when omitted. */
  state?: 'new' | 'established';
}

export interface WizardDraft {
  title: string;
  markdown: string;
  difficulty?: 'basis' | 'gevorderd';
  requirements: WizardRequirement[];
  internet: boolean;
  vlans: WizardVlan[];
  /** Keyed by WizardRequirement.key. */
  intentChoices: Record<string, WizardIntentChoice>;
}

// Shared with the rest of the app, so the wizard and renaming on the canvas apply the same rules.
export { RESERVED_NODE_NAMES };

/**
 * Unique key for wizard items. crypto.randomUUID() only exists in secure
 * contexts (https or localhost), so opening the dev server via its LAN IP
 * would otherwise throw when adding a requirement or VLAN.
 */
export function makeKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type WizardStep = 1 | 2 | 3 | 4;

/**
 * Everything the wizard needs to resume where it was: kept outside the
 * dialog, so closing it (Esc, clicking outside, ✕) does not discard a
 * half-built scenario.
 */
export interface WizardSession {
  draft: WizardDraft;
  step: WizardStep;
  maxReachedStep: WizardStep;
}

export function createWizardSession(): WizardSession {
  return { draft: createEmptyDraft(), step: 1, maxReachedStep: 1 };
}

/** Whether anything was entered yet — only then is there a draft worth resuming. */
export function isDraftStarted(draft: WizardDraft): boolean {
  return (
    draft.title.trim() !== '' ||
    draft.markdown.trim() !== '' ||
    draft.requirements.some(r => r.text.trim() !== '') ||
    draft.vlans.length > 0 ||
    draft.internet
  );
}

export function createEmptyDraft(): WizardDraft {
  return {
    title: '',
    markdown: '',
    requirements: [],
    internet: false,
    vlans: [],
    intentChoices: {}
  };
}

/** Lowercased, accent-stripped, dash-separated slug — falls back to 'scenario' if nothing survives. */
export function slugify(title: string): string {
  return title
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'scenario';
}

/** Appends -2, -3, ... until `base` no longer collides with `existingIds`. */
export function uniqueSlug(base: string, existingIds: string[]): string {
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** All node names an intent's bron/doel dropdown can offer: Internet (if enabled) + every VLAN/host name. */
/**
 * The one place where the wizard normalises a VLAN/host name. The draft keeps
 * what was typed (so typing "DATA 2" is not disturbed by trimming halfway);
 * everything that leaves the draft — the dropdown values, the checks and the
 * built scenario — goes through this, so intents and topology always agree.
 */
export const cleanName = (name: string) => name.trim();

export function availableNodeNames(draft: WizardDraft): string[] {
  return [
    ...(draft.internet ? ['Internet'] : []),
    ...draft.vlans.flatMap(v => [v.name, ...v.hosts]).map(cleanName).filter(Boolean)
  ];
}

export interface IntentEndpointOption {
  value: string;
  label: string;
}

/**
 * Every value an intent's bron/doel dropdown can offer: the `ANY_VLAN`/
 * `ANY_HOST` wildcards (only shown when at least one matching element
 * exists) followed by every concrete node name — so a docent can express
 * "elke VLAN mag naar internet" as one requirement instead of one per VLAN.
 */
export function intentEndpointOptions(draft: WizardDraft): IntentEndpointOption[] {
  const options: IntentEndpointOption[] = [];
  if (draft.vlans.length > 0) options.push({ value: 'ANY_VLAN', label: 'Elke VLAN' });
  if (draft.vlans.some(v => v.hosts.length > 0)) options.push({ value: 'ANY_HOST', label: 'Elke host' });
  availableNodeNames(draft).forEach(name => options.push({ value: name, label: name }));
  return options;
}

/**
 * Bron/doel of a requirement's choice that no longer exist in the topology —
 * e.g. a VLAN renamed or removed, or "internettoegang" unticked, after step
 * 4 was filled in. Such an intent could never be resolved, so the wizard
 * flags it instead of silently producing a requirement that always fails.
 */
export function staleIntentEndpoints(draft: WizardDraft, choice: WizardIntentChoice | undefined): string[] {
  if (!choice) return [];
  const values = new Set(intentEndpointOptions(draft).map(o => o.value));
  return [choice.from, choice.to].filter(v => v !== '' && !values.has(cleanName(v)));
}

/** Keys of the filled-in requirements whose choice points at something that no longer exists. */
export function requirementsWithStaleChoices(draft: WizardDraft): string[] {
  return draft.requirements
    .filter(r => r.text.trim() !== '' && staleIntentEndpoints(draft, draft.intentChoices[r.key]).length > 0)
    .map(r => r.key);
}

/** Every name used in the topology, lowercased, for duplicate/reserved-name checks (excludes 'Internet' itself). */
export function topologyNamesLowerCase(draft: WizardDraft): string[] {
  return draft.vlans.flatMap(v => [v.name, ...v.hosts]).map(n => cleanName(n).toLowerCase());
}

/** Duplicate (case-insensitive) or reserved VLAN/host names — surfaced as a validation message. */
export function findTopologyNameIssues(vlans: WizardVlan[]): string[] {
  const seen = new Map<string, number>();
  const issues: string[] = [];

  vlans.flatMap(v => [v.name, ...v.hosts]).forEach(rawName => {
    const name = cleanName(rawName);
    if (!name) return;
    const lower = name.toLowerCase();
    if (RESERVED_NODE_NAMES.includes(lower)) {
      issues.push(`"${name}" is een gereserveerde naam (router, internet of een wildcard zoals ANY)`);
    }
    seen.set(lower, (seen.get(lower) ?? 0) + 1);
  });

  seen.forEach((count, lower) => {
    if (count > 1) issues.push(`"${lower}" komt meer dan één keer voor — namen moeten uniek zijn`);
  });

  return issues;
}

const INTENT_ENDPOINT_LABELS: Record<string, string> = {
  ANY_VLAN: 'elke VLAN',
  ANY_HOST: 'elke host',
  ANY_INTERNET: 'elk internettoegangspunt',
  ANY: 'elk netwerk-element'
};

function describeIntentEndpoint(ref: string): string {
  return INTENT_ENDPOINT_LABELS[ref] ?? ref;
}

export function describeIntent(from: string, to: string, expect: 'allow' | 'drop', state: 'new' | 'established'): string {
  const verb = expect === 'allow' ? 'mag verbinden met' : 'mag niet verbinden met';
  const stateLabel = state === 'established' ? 'Bestaand verkeer van' : 'Nieuw verkeer van';
  return `${stateLabel} ${describeIntentEndpoint(from)} ${verb} ${describeIntentEndpoint(to)}`;
}

/**
 * Assembles a valid Scenario from a wizard draft. Requirements with empty
 * text are dropped; R#/intent ids are assigned from the *filtered* list's
 * position, and each intent is looked up via the original requirement's
 * stable `key` — never via array index against the unfiltered list — so a
 * requirement removed mid-way through step 4 can never shift another
 * requirement's answer onto the wrong id.
 */
export function buildScenarioFromDraft(draft: WizardDraft): Scenario {
  const id = uniqueSlug(slugify(draft.title), SCENARIOS.map(s => s.meta.id));
  const filledRequirements = draft.requirements.filter(r => r.text.trim() !== '');

  const requirements: ScenarioRequirement[] = filledRequirements.map((r, i) => ({
    id: `R${i + 1}`,
    text: r.text.trim()
  }));

  const intents: ScenarioIntent[] = filledRequirements
    .map((r, i): ScenarioIntent | null => {
      const choice = draft.intentChoices[r.key];
      if (!choice) return null;
      // `state` defaults to 'new' in the UI's Select display but is only
      // actually written into intentChoices once the user touches that
      // dropdown — fall back here too, so an untouched default still
      // produces an explicit (not legacy-undefined) state.
      const state = choice.state ?? 'new';
      return {
        id: `i${i + 1}`,
        requirementId: requirements[i].id,
        description: describeIntent(cleanName(choice.from), cleanName(choice.to), choice.expect, state),
        from: cleanName(choice.from),
        to: cleanName(choice.to),
        expect: choice.expect,
        state
      };
    })
    .filter((intent): intent is ScenarioIntent => intent !== null);

  return {
    meta: { id, title: draft.title.trim(), difficulty: draft.difficulty },
    brief: { markdown: draft.markdown.trim(), requirements },
    topology: {
      internet: draft.internet,
      vlans: draft.vlans.map(v => ({ name: cleanName(v.name), hosts: v.hosts.map(cleanName) }))
    },
    intents
  };
}
