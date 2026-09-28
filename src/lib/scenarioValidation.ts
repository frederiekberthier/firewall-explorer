import { Scenario } from '@/types/scenario';
import { RESERVED_NODE_NAMES } from './nodeNames';
import { isIntentWildcardToken } from './scenarioGrading';

export type ScenarioValidation =
  | { ok: true; scenario: Scenario }
  | { ok: false; errors: string[] };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/**
 * Checks a scenario from an untrusted source (pasted JSON, a downloaded
 * file) field by field, so a malformed file is rejected with a message that
 * says what is wrong instead of crashing the app later. Mirrors the
 * `Scenario` type plus the rules the rest of the app relies on: unique
 * requirement ids, unique and non-reserved node names, and intents that
 * point at an existing requirement and at nodes that exist in the topology.
 */
export function validateScenario(value: unknown): ScenarioValidation {
  const errors: string[] = [];
  const err = (path: string, message: string) => errors.push(`${path}: ${message}`);

  if (!isObject(value)) return { ok: false, errors: ['Het scenario moet een JSON-object zijn ({ ... }).'] };

  // meta
  const meta = value.meta;
  if (!isObject(meta)) {
    err('meta', 'ontbreekt of is geen object');
  } else {
    if (!isNonEmptyString(meta.id)) err('meta.id', 'moet een niet-lege tekst zijn');
    if (!isNonEmptyString(meta.title)) err('meta.title', 'moet een niet-lege tekst zijn');
    if (meta.difficulty !== undefined && meta.difficulty !== 'basis' && meta.difficulty !== 'gevorderd') {
      err('meta.difficulty', 'moet "basis" of "gevorderd" zijn');
    }
  }

  // brief
  const requirementIds = new Set<string>();
  const brief = value.brief;
  if (!isObject(brief)) {
    err('brief', 'ontbreekt of is geen object');
  } else {
    if (typeof brief.markdown !== 'string') err('brief.markdown', 'moet een tekst zijn');
    if (!Array.isArray(brief.requirements)) {
      err('brief.requirements', 'moet een lijst zijn');
    } else {
      brief.requirements.forEach((req, i) => {
        const path = `brief.requirements[${i}]`;
        if (!isObject(req)) return err(path, 'moet een object zijn met id en text');
        if (!isNonEmptyString(req.id)) err(`${path}.id`, 'moet een niet-lege tekst zijn');
        else if (requirementIds.has(req.id)) err(`${path}.id`, `"${req.id}" komt meer dan één keer voor`);
        else requirementIds.add(req.id);
        if (typeof req.text !== 'string') err(`${path}.text`, 'moet een tekst zijn');
      });
    }
  }

  // topology
  // Exact names intents may refer to — the self-test looks nodes up by exact
  // name, so "data" does not find a VLAN called "DATA". The router always exists.
  const nodeNames = new Set<string>(['Router']);
  const topology = value.topology;
  let hasInternet = false;
  if (!isObject(topology)) {
    err('topology', 'ontbreekt of is geen object');
  } else {
    if (topology.internet !== undefined && typeof topology.internet !== 'boolean') {
      err('topology.internet', 'moet true of false zijn');
    }
    hasInternet = topology.internet === true;
    if (hasInternet) nodeNames.add('Internet');

    const seen = new Set<string>();
    const checkName = (path: string, name: unknown) => {
      if (!isNonEmptyString(name)) return err(path, 'moet een niet-lege naam zijn');
      const lower = name.trim().toLowerCase();
      if (RESERVED_NODE_NAMES.includes(lower)) return err(path, `"${name}" is een gereserveerde naam`);
      if (seen.has(lower)) return err(path, `de naam "${name}" komt meer dan één keer voor — namen moeten uniek zijn`);
      seen.add(lower);
      nodeNames.add(name);
    };

    if (!Array.isArray(topology.vlans)) {
      err('topology.vlans', 'moet een lijst zijn');
    } else {
      topology.vlans.forEach((vlan, i) => {
        const path = `topology.vlans[${i}]`;
        if (!isObject(vlan)) return err(path, 'moet een object zijn met name (en optioneel hosts)');
        checkName(`${path}.name`, vlan.name);
        if (vlan.hosts === undefined) return;
        if (!Array.isArray(vlan.hosts)) return err(`${path}.hosts`, 'moet een lijst van namen zijn');
        vlan.hosts.forEach((host, h) => checkName(`${path}.hosts[${h}]`, host));
      });
    }
  }

  // intents (optional)
  if (value.intents !== undefined) {
    if (!Array.isArray(value.intents)) {
      err('intents', 'moet een lijst zijn (of weggelaten worden)');
    } else {
      value.intents.forEach((intent, i) => {
        const path = `intents[${i}]`;
        if (!isObject(intent)) return err(path, 'moet een object zijn');
        if (!isNonEmptyString(intent.id)) err(`${path}.id`, 'moet een niet-lege tekst zijn');
        if (!isNonEmptyString(intent.requirementId)) err(`${path}.requirementId`, 'moet een niet-lege tekst zijn');
        else if (requirementIds.size > 0 && !requirementIds.has(intent.requirementId)) {
          err(`${path}.requirementId`, `verwijst naar "${intent.requirementId}", maar die vereiste bestaat niet`);
        }
        if (typeof intent.description !== 'string') err(`${path}.description`, 'moet een tekst zijn');
        for (const side of ['from', 'to'] as const) {
          const ref = intent[side];
          if (!isNonEmptyString(ref)) err(`${path}.${side}`, 'moet een niet-lege tekst zijn');
          else if (!isIntentWildcardToken(ref) && !nodeNames.has(ref)) {
            err(`${path}.${side}`, `"${ref}" bestaat niet in de topologie (namen zijn hoofdlettergevoelig)`);
          }
        }
        if (intent.expect !== 'allow' && intent.expect !== 'drop') err(`${path}.expect`, 'moet "allow" of "drop" zijn');
        if (intent.state !== undefined && intent.state !== 'new' && intent.state !== 'established') {
          err(`${path}.state`, 'moet "new" of "established" zijn (of weggelaten worden)');
        }
      });
    }
  }

  return errors.length === 0 ? { ok: true, scenario: value as unknown as Scenario } : { ok: false, errors };
}
