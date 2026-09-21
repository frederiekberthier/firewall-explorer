import { Scenario } from '@/types/scenario';

// Built-in scenario catalogue. Each scenario is a recognizable situation
// (per the README's own guidance for contributed scenarios) plus a handful
// of requirements a student's ruleset should satisfy. Each requirement has
// a matching intent so the self-test (src/lib/scenarioGrading.ts) can check
// it automatically — a requirement without an intent just can't be checked
// live, it still shows up as plain text.
export const SCENARIOS: Scenario[] = [
  {
    meta: { id: 'h5-1-kantoor-sec', title: 'Kantoor met camerabewaking', difficulty: 'basis' },
    brief: {
      markdown:
        'Een kantoor heeft een DATA-VLAN voor de medewerkers en een apart SEC-VLAN voor de ' +
        'bewakingscamera\'s. Beide VLAN\'s hebben internettoegang nodig, maar camera\'s horen niet ' +
        'zomaar bereikbaar te zijn vanuit het datanetwerk, en het datanetwerk hoort niet zomaar bij ' +
        'de camera\'s te kunnen.',
      requirements: [
        { id: 'R1', text: 'DATA mag naar internet' },
        { id: 'R2', text: 'SEC (camera\'s) mag geen nieuw verkeer naar internet initiëren' },
        { id: 'R3', text: 'DATA mag geen nieuw verkeer naar SEC initiëren' },
        { id: 'R4', text: 'SEC mag geen nieuw verkeer naar DATA initiëren' }
      ]
    },
    topology: {
      internet: true,
      vlans: [
        { name: 'DATA', hosts: ['PC 1', 'PC 2'] },
        { name: 'SEC', hosts: ['Camera 1', 'Camera 2'] }
      ]
    },
    intents: [
      { id: 'i1', requirementId: 'R1', description: 'DATA -> Internet (new + reply)', from: 'DATA', to: 'Internet', expect: 'allow' },
      { id: 'i2', requirementId: 'R2', description: 'SEC -> Internet (new)', from: 'SEC', to: 'Internet', expect: 'drop' },
      { id: 'i3', requirementId: 'R3', description: 'DATA -> SEC (new)', from: 'DATA', to: 'SEC', expect: 'drop' },
      { id: 'i4', requirementId: 'R4', description: 'SEC -> DATA (new)', from: 'SEC', to: 'DATA', expect: 'drop' }
    ]
  },
  {
    meta: { id: 'coworking-gastennetwerk', title: 'Co-working met gastennetwerk', difficulty: 'basis' },
    brief: {
      markdown:
        'Een co-workingspace heeft een STAFF-VLAN voor de vaste medewerkers en een GUEST-VLAN voor ' +
        'bezoekers. Gasten mogen internetten, maar mogen nooit bij het staff-netwerk kunnen — ook niet ' +
        'per ongeluk via een geïnitieerde verbinding vanuit GUEST.',
      requirements: [
        { id: 'R1', text: 'STAFF mag naar internet' },
        { id: 'R2', text: 'GUEST mag naar internet' },
        { id: 'R3', text: 'GUEST mag geen nieuw verkeer naar STAFF initiëren' },
        { id: 'R4', text: 'STAFF mag wel bij GUEST (bv. voor support)' }
      ]
    },
    topology: {
      internet: true,
      vlans: [
        { name: 'STAFF', hosts: ['Laptop 1'] },
        { name: 'GUEST', hosts: ['Gast 1', 'Gast 2'] }
      ]
    },
    intents: [
      { id: 'i1', requirementId: 'R1', description: 'STAFF -> Internet (new + reply)', from: 'STAFF', to: 'Internet', expect: 'allow' },
      { id: 'i2', requirementId: 'R2', description: 'GUEST -> Internet (new + reply)', from: 'GUEST', to: 'Internet', expect: 'allow' },
      { id: 'i3', requirementId: 'R3', description: 'GUEST -> STAFF (new)', from: 'GUEST', to: 'STAFF', expect: 'drop' },
      { id: 'i4', requirementId: 'R4', description: 'STAFF -> GUEST (new + reply)', from: 'STAFF', to: 'GUEST', expect: 'allow' }
    ]
  }
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.meta.id === id);
}
