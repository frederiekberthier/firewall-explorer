import { describe, it, expect } from 'vitest';
import { validateScenario } from './scenarioValidation';
import { SCENARIOS } from '@/data/scenarios';
import { buildScenarioFromDraft } from './scenarioWizard';

const valid = () => ({
  meta: { id: 'test', title: 'Test' },
  brief: { markdown: 'Uitleg', requirements: [{ id: 'R1', text: 'DATA mag naar internet' }] },
  topology: { internet: true, vlans: [{ name: 'DATA', hosts: ['PC 1'] }] },
  intents: [{ id: 'i1', requirementId: 'R1', description: '', from: 'DATA', to: 'Internet', expect: 'allow' }]
});

const errorsFor = (value: unknown) => {
  const result = validateScenario(value);
  return result.ok ? [] : result.errors;
};

describe('validateScenario', () => {
  it('accepts every scenario in the catalogue', () => {
    for (const scenario of SCENARIOS) {
      expect(errorsFor(JSON.parse(JSON.stringify(scenario)))).toEqual([]);
    }
  });

  it('accepts a scenario built with the wizard', () => {
    const scenario = buildScenarioFromDraft({
      title: 'Wizard', markdown: 'M', difficulty: 'basis',
      requirements: [{ key: 'k1', text: 'DATA mag naar internet' }],
      internet: true,
      vlans: [{ key: 'v1', name: 'DATA', hosts: ['PC 1'] }],
      intentChoices: { k1: { from: 'ANY_VLAN', to: 'Internet', expect: 'allow', state: 'new' } }
    });
    expect(errorsFor(JSON.parse(JSON.stringify(scenario)))).toEqual([]);
  });

  it('rejects a null requirement instead of crashing later (blank page)', () => {
    expect(errorsFor({ ...valid(), brief: { markdown: '', requirements: [null] } }))
      .toContain('brief.requirements[0]: moet een object zijn met id en text');
  });

  it('rejects a null VLAN with a precise message instead of throwing', () => {
    expect(() => validateScenario({ ...valid(), topology: { vlans: [null] } })).not.toThrow();
    expect(errorsFor({ ...valid(), topology: { vlans: [null] }, intents: [] }))
      .toContain('topology.vlans[0]: moet een object zijn met name (en optioneel hosts)');
  });

  it('checks names: non-empty, unique (ignoring case) and not reserved', () => {
    const errors = errorsFor({
      ...valid(),
      topology: { internet: true, vlans: [{ name: 'DATA', hosts: ['data', ''] }, { name: 'Router' }] },
      intents: []
    });
    expect(errors).toContain('topology.vlans[0].hosts[0]: de naam "data" komt meer dan één keer voor — namen moeten uniek zijn');
    expect(errors).toContain('topology.vlans[0].hosts[1]: moet een niet-lege naam zijn');
    expect(errors).toContain('topology.vlans[1].name: "Router" is een gereserveerde naam');
  });

  it('checks intents: existing requirement, existing nodes (exact name), valid expect/state', () => {
    const errors = errorsFor({
      ...valid(),
      intents: [{ id: 'i1', requirementId: 'R9', description: '', from: 'data', to: 'Internet', expect: 'yes', state: 'old' }]
    });
    expect(errors).toContain('intents[0].requirementId: verwijst naar "R9", maar die vereiste bestaat niet');
    expect(errors).toContain('intents[0].from: "data" bestaat niet in de topologie (namen zijn hoofdlettergevoelig)');
    expect(errors).toContain('intents[0].expect: moet "allow" of "drop" zijn');
    expect(errors).toContain('intents[0].state: moet "new" of "established" zijn (of weggelaten worden)');
  });

  it('accepts wildcards and the Router/Internet nodes in intents', () => {
    const scenario = { ...valid(), intents: [
      { id: 'i1', requirementId: 'R1', description: '', from: 'ANY_VLAN', to: 'Router', expect: 'drop' },
      { id: 'i2', requirementId: 'R1', description: '', from: 'ANY', to: 'Internet', expect: 'drop' }
    ] };
    expect(errorsFor(scenario)).toEqual([]);
  });

  it('rejects Internet in an intent when the topology has no internet', () => {
    const scenario = { ...valid(), topology: { vlans: [{ name: 'DATA' }] } };
    expect(errorsFor(scenario)).toContain('intents[0].to: "Internet" bestaat niet in de topologie (namen zijn hoofdlettergevoelig)');
  });

  it('rejects things that are not a scenario at all', () => {
    expect(errorsFor(null)).toEqual(['Het scenario moet een JSON-object zijn ({ ... }).']);
    expect(errorsFor([])).toEqual(['Het scenario moet een JSON-object zijn ({ ... }).']);
    expect(errorsFor({})).toEqual(expect.arrayContaining([
      'meta: ontbreekt of is geen object',
      'brief: ontbreekt of is geen object',
      'topology: ontbreekt of is geen object'
    ]));
  });
});
