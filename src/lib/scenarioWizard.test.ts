// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkState } from '@/hooks/useNetworkState';
import { gradeScenario } from './scenarioGrading';
import {
  slugify,
  uniqueSlug,
  describeIntent,
  buildScenarioFromDraft,
  availableNodeNames,
  findTopologyNameIssues,
  intentEndpointOptions,
  staleIntentEndpoints,
  requirementsWithStaleChoices,
  makeKey,
  isDraftStarted,
  createEmptyDraft,
  WizardDraft
} from './scenarioWizard';

describe('slugify', () => {
  it('strips accents and collapses punctuation/spaces to dashes', () => {
    // The apostrophe is itself non-alphanumeric, so it becomes a separator
    // rather than being silently dropped — "camera's" -> "camera-s".
    expect(slugify("Kantoor met Camera's!!")).toBe('kantoor-met-camera-s');
  });

  it('falls back to a default when nothing survives', () => {
    expect(slugify('???')).toBe('scenario');
  });
});

describe('uniqueSlug', () => {
  it('appends -2, then -3 on repeated collisions', () => {
    expect(uniqueSlug('foo', ['foo', 'foo-2'])).toBe('foo-3');
  });

  it('leaves the slug unchanged when there is no collision', () => {
    expect(uniqueSlug('bar', ['foo'])).toBe('bar');
  });
});

describe('describeIntent', () => {
  it('describes a new-traffic allow intent', () => {
    expect(describeIntent('DATA', 'Internet', 'allow', 'new')).toBe('Nieuw verkeer van DATA mag verbinden met Internet');
  });

  it('describes a new-traffic drop intent', () => {
    expect(describeIntent('SEC', 'DATA', 'drop', 'new')).toBe('Nieuw verkeer van SEC mag niet verbinden met DATA');
  });

  it('describes an established-traffic intent', () => {
    expect(describeIntent('DATA', 'Internet', 'allow', 'established'))
      .toBe('Bestaand verkeer van DATA mag verbinden met Internet');
  });

  it('translates wildcard tokens to plain-language labels', () => {
    expect(describeIntent('ANY_VLAN', 'Internet', 'allow', 'new')).toBe('Nieuw verkeer van elke VLAN mag verbinden met Internet');
    expect(describeIntent('ANY_HOST', 'SEC', 'drop', 'new')).toBe('Nieuw verkeer van elke host mag niet verbinden met SEC');
  });
});

function fullDraft(): WizardDraft {
  return {
    title: 'Test scenario',
    markdown: 'Een test-opdracht.',
    difficulty: 'basis',
    requirements: [
      { key: 'k1', text: 'DATA mag naar internet' },
      { key: 'k2', text: 'SEC mag niet naar DATA' }
    ],
    internet: true,
    vlans: [
      { key: 'v3', name: 'DATA', hosts: ['PC 1'] },
      { key: 'v4', name: 'SEC', hosts: ['Camera 1'] }
    ],
    intentChoices: {
      k1: { from: 'DATA', to: 'Internet', expect: 'allow' },
      k2: { from: 'SEC', to: 'DATA', expect: 'drop' }
    }
  };
}

describe('availableNodeNames', () => {
  it('includes Internet plus every VLAN and host name', () => {
    expect(availableNodeNames(fullDraft())).toEqual(['Internet', 'DATA', 'PC 1', 'SEC', 'Camera 1']);
  });

  it('omits Internet when the topology has none', () => {
    const draft = fullDraft();
    draft.internet = false;
    expect(availableNodeNames(draft)).not.toContain('Internet');
  });
});

describe('findTopologyNameIssues', () => {
  it('flags a case-insensitive duplicate name across VLANs', () => {
    const issues = findTopologyNameIssues([
      { key: 'v5', name: 'DATA', hosts: ['PC 1'] },
      { key: 'v6', name: 'data', hosts: [] }
    ]);
    expect(issues.some(i => i.includes('data'))).toBe(true);
  });

  it('flags reserved names', () => {
    const issues = findTopologyNameIssues([{ key: 'v7', name: 'Internet', hosts: [] }]);
    expect(issues.some(i => i.includes('gereserveerde naam'))).toBe(true);
  });

  it('reports nothing for a clean topology', () => {
    expect(findTopologyNameIssues([{ key: 'v8', name: 'DATA', hosts: ['PC 1', 'PC 2'] }])).toHaveLength(0);
  });
});

describe('intentEndpointOptions', () => {
  it('offers ANY_VLAN once at least one VLAN exists, and ANY_HOST once a host exists', () => {
    const draft = fullDraft(); // 2 VLANs, each with 1 host
    const values = intentEndpointOptions(draft).map(o => o.value);
    expect(values).toContain('ANY_VLAN');
    expect(values).toContain('ANY_HOST');
  });

  it('omits ANY_HOST when no VLAN has any host', () => {
    const draft = fullDraft();
    draft.vlans = draft.vlans.map(v => ({ ...v, hosts: [] }));
    const values = intentEndpointOptions(draft).map(o => o.value);
    expect(values).toContain('ANY_VLAN');
    expect(values).not.toContain('ANY_HOST');
  });

  it('omits both wildcards when there are no VLANs at all', () => {
    const draft = fullDraft();
    draft.vlans = [];
    const values = intentEndpointOptions(draft).map(o => o.value);
    expect(values).not.toContain('ANY_VLAN');
    expect(values).not.toContain('ANY_HOST');
  });
});

describe('buildScenarioFromDraft', () => {
  it('assembles a valid Scenario with sequential R#/intent ids', () => {
    const scenario = buildScenarioFromDraft(fullDraft());

    expect(scenario.meta.id).toBe('test-scenario');
    expect(scenario.brief.requirements).toEqual([
      { id: 'R1', text: 'DATA mag naar internet' },
      { id: 'R2', text: 'SEC mag niet naar DATA' }
    ]);
    expect(scenario.intents).toHaveLength(2);
    expect(scenario.intents![0]).toMatchObject({
      requirementId: 'R1',
      from: 'DATA',
      to: 'Internet',
      expect: 'allow',
      state: 'new',
      description: 'Nieuw verkeer van DATA mag verbinden met Internet'
    });
    expect(scenario.intents![1]).toMatchObject({
      requirementId: 'R2',
      from: 'SEC',
      to: 'DATA',
      expect: 'drop',
      state: 'new',
      description: 'Nieuw verkeer van SEC mag niet verbinden met DATA'
    });
    expect(scenario.topology).toEqual({
      internet: true,
      vlans: [
        { name: 'DATA', hosts: ['PC 1'] },
        { name: 'SEC', hosts: ['Camera 1'] }
      ]
    });
  });

  it('drops empty requirement rows and re-sequences the remaining ids', () => {
    const draft = fullDraft();
    draft.requirements = [
      { key: 'k1', text: 'DATA mag naar internet' },
      { key: 'empty', text: '   ' },
      { key: 'k2', text: 'SEC mag niet naar DATA' }
    ];

    const scenario = buildScenarioFromDraft(draft);

    expect(scenario.brief.requirements.map(r => r.id)).toEqual(['R1', 'R2']);
    expect(scenario.intents!.map(i => i.requirementId)).toEqual(['R1', 'R2']);
  });

  it('re-sequences ids correctly when an earlier requirement was removed from the draft', () => {
    // Simulates: k2 was deleted after intentChoices for k1/k3 were already set.
    const draft: WizardDraft = {
      ...fullDraft(),
      requirements: [
        { key: 'k1', text: 'DATA mag naar internet' },
        { key: 'k3', text: 'DATA mag naar SEC' }
      ],
      intentChoices: {
        k1: { from: 'DATA', to: 'Internet', expect: 'allow' },
        k3: { from: 'DATA', to: 'SEC', expect: 'allow' }
      }
    };

    const scenario = buildScenarioFromDraft(draft);

    expect(scenario.intents).toHaveLength(2);
    expect(scenario.intents![1].requirementId).toBe('R2');
    expect(scenario.intents![1].from).toBe('DATA');
    expect(scenario.intents![1].to).toBe('SEC');
  });

  it('defaults state to "new" when a choice never explicitly set it', () => {
    // Simulates a user who never touched the Nieuw/Bestaand dropdown — the
    // UI still displays "Nieuw verkeer" as selected, so the built scenario
    // must match that, not silently fall back to legacy undefined-state
    // behavior in the grading engine.
    const draft = fullDraft();
    draft.intentChoices.k1 = { from: 'DATA', to: 'Internet', expect: 'allow' };

    const scenario = buildScenarioFromDraft(draft);

    expect(scenario.intents![0].state).toBe('new');
  });

  it('preserves an explicitly chosen "established" state', () => {
    const draft = fullDraft();
    draft.intentChoices.k1 = { from: 'DATA', to: 'Internet', expect: 'allow', state: 'established' };

    const scenario = buildScenarioFromDraft(draft);

    expect(scenario.intents![0].state).toBe('established');
  });

  it('omits an intent for a requirement with no recorded choice yet', () => {
    const draft = fullDraft();
    draft.intentChoices = { k1: draft.intentChoices.k1 };

    const scenario = buildScenarioFromDraft(draft);

    expect(scenario.intents).toHaveLength(1);
    expect(scenario.intents![0].requirementId).toBe('R1');
  });
});

describe('wizard names with surrounding whitespace', () => {
  const draftWithSpaces = (): WizardDraft => ({
    title: 'Spaties',
    markdown: 'Test',
    difficulty: 'basis',
    requirements: [{ key: 'k1', text: 'DATA mag naar internet' }],
    internet: true,
    vlans: [{ key: 'v9', name: 'DATA ', hosts: [' PC 1 '] }],
    intentChoices: { k1: { from: 'DATA ', to: 'Internet', expect: 'drop', state: 'new' } }
  });

  it('offers trimmed names in the intent dropdowns', () => {
    expect(availableNodeNames(draftWithSpaces())).toEqual(['Internet', 'DATA', 'PC 1']);
  });

  it('builds a scenario whose intents match the (trimmed) topology names', () => {
    const scenario = buildScenarioFromDraft(draftWithSpaces());
    expect(scenario.topology.vlans).toEqual([{ name: 'DATA', hosts: ['PC 1'] }]);
    expect(scenario.intents![0]).toMatchObject({ from: 'DATA', to: 'Internet' });
  });

  it('lets the self-test find the elements after loading the scenario', () => {
    const scenario = buildScenarioFromDraft(draftWithSpaces());
    const { result } = renderHook(() => useNetworkState());
    act(() => { result.current.loadScenario(scenario); });

    const report = gradeScenario(scenario, result.current.nodes, [], 'block-all');
    expect(report.intentResults[0].reason).not.toContain('niet terugvinden');
    expect(report.intentResults[0].pass).toBe(true); // drop intent, block-all, no rules
  });
});

describe('stale intent choices after editing the topology', () => {
  const base = (): WizardDraft => ({
    title: 'T', markdown: 'M', difficulty: 'basis',
    requirements: [{ key: 'k1', text: 'DATA mag naar internet' }, { key: 'k2', text: 'SEC niet naar DATA' }],
    internet: true,
    vlans: [{ key: 'v10', name: 'DATA', hosts: [] }, { key: 'v11', name: 'SEC', hosts: [] }],
    intentChoices: {
      k1: { from: 'DATA', to: 'Internet', expect: 'allow', state: 'new' },
      k2: { from: 'SEC', to: 'DATA', expect: 'drop', state: 'new' }
    }
  });

  it('reports nothing while every choice still exists', () => {
    expect(requirementsWithStaleChoices(base())).toEqual([]);
  });

  it('flags choices that point at a renamed VLAN', () => {
    const draft = { ...base(), vlans: [{ key: 'v10', name: 'KANTOOR', hosts: [] }, { key: 'v11', name: 'SEC', hosts: [] }] };
    expect(staleIntentEndpoints(draft, draft.intentChoices.k1)).toEqual(['DATA']);
    expect(staleIntentEndpoints(draft, draft.intentChoices.k2)).toEqual(['DATA']);
    expect(requirementsWithStaleChoices(draft)).toEqual(['k1', 'k2']);
  });

  it('flags Internet when internet access is unticked', () => {
    const draft = { ...base(), internet: false };
    expect(requirementsWithStaleChoices(draft)).toEqual(['k1']);
  });

  it('flags a wildcard that no longer applies', () => {
    const draft = { ...base(), intentChoices: { ...base().intentChoices, k1: { from: 'ANY_HOST', to: 'Internet', expect: 'allow' as const } } };
    // There are no hosts, so "Elke host" is no longer offered.
    expect(staleIntentEndpoints(draft, draft.intentChoices.k1)).toEqual(['ANY_HOST']);
  });

  it('ignores requirements without text or without a choice yet', () => {
    const draft = { ...base(), requirements: [...base().requirements, { key: 'k3', text: '  ' }], internet: false };
    draft.intentChoices = { ...draft.intentChoices, k3: { from: 'Internet', to: 'DATA', expect: 'drop' } };
    expect(requirementsWithStaleChoices(draft)).toEqual(['k1']);
  });
});

describe('makeKey', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('works without crypto.randomUUID (e.g. the dev server opened via its LAN IP over http)', () => {
    vi.stubGlobal('crypto', {});
    const keys = new Set(Array.from({ length: 50 }, () => makeKey()));
    expect(keys.size).toBe(50);
  });
});

describe('isDraftStarted', () => {
  it('is false for an empty draft and true as soon as something is entered', () => {
    expect(isDraftStarted(createEmptyDraft())).toBe(false);
    expect(isDraftStarted({ ...createEmptyDraft(), title: 'Kantoor' })).toBe(true);
    expect(isDraftStarted({ ...createEmptyDraft(), internet: true })).toBe(true);
    expect(isDraftStarted({ ...createEmptyDraft(), requirements: [{ key: 'k', text: '  ' }] })).toBe(false);
  });
});

