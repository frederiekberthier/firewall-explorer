import { describe, it, expect } from 'vitest';
import {
  slugify,
  uniqueSlug,
  describeIntent,
  buildScenarioFromDraft,
  availableNodeNames,
  findTopologyNameIssues,
  intentEndpointOptions,
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
      { name: 'DATA', hosts: ['PC 1'] },
      { name: 'SEC', hosts: ['Camera 1'] }
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
      { name: 'DATA', hosts: ['PC 1'] },
      { name: 'data', hosts: [] }
    ]);
    expect(issues.some(i => i.includes('data'))).toBe(true);
  });

  it('flags reserved names', () => {
    const issues = findTopologyNameIssues([{ name: 'Internet', hosts: [] }]);
    expect(issues.some(i => i.includes('gereserveerde naam'))).toBe(true);
  });

  it('reports nothing for a clean topology', () => {
    expect(findTopologyNameIssues([{ name: 'DATA', hosts: ['PC 1', 'PC 2'] }])).toHaveLength(0);
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
