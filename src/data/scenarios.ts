import { Scenario } from '@/types/scenario';

// Built-in scenario catalogue. Each scenario is a recognizable situation
// (per the README's own guidance for contributed scenarios) plus a handful
// of requirements a student's ruleset should satisfy. Each requirement has
// a matching intent so the self-test (src/lib/scenarioGrading.ts) can check
// it automatically — a requirement without an intent just can't be checked
// live, it still shows up as plain text.
export const SCENARIOS: Scenario[] = [
  {
    meta: { id: 'h5-cursus_data_iot', title: 'Cursusvoorbeeld Data en IoT VLAN', difficulty: 'basis' },
    brief: {
      markdown:
        'OEFENING UIT DE CURSUS HOOFDSTUK 5 \n\n' +
        'Voor een bedrijfssituatie moet je een netwerk uitwerken met gescheiden IOT-netwerk en een datanetwerk. Uiteraard gaan we dat met VLAN\'s oplossen.\n' +
        'We voorzien 2 VLAN\'s, VLAN 10 is voor het gewone netwerk, we noemen dit DATA. VLAN 20 is voor het IOT-netwerk. ' +
        'Het DATA-netwerk  en het IOT-netwerk krijgen toegang tot het internet.',
      requirements: [
        { id: 'R1', text: 'Related/Established verkeer laten we toe' },
        { id: 'R2', text: 'DATA mag nieuw verkeer naar overal initiëren' },
        { id: 'R3', text: 'IOT mag geen nieuw verkeer naar DATA initiëren' }
      ]
    },
    topology: {
      internet: true,
      vlans: [
        { name: 'VLAN10-DATA', hosts: ['PC 1'] },
        { name: 'VLAN20-IOT', hosts: ['Home-Assistant'] }
      ]
    },
    intents: [
      { id: 'i1', requirementId: 'R1', description: 'RELATED ESTABLISHED verkeer laten we toe', from: 'ANY', to: 'ANY', expect: 'allow', state: 'established' },
      { id: 'i2', requirementId: 'R2', description: 'VLAN10-DATA -> ANY (new)', from: 'VLAN10-DATA', to: 'ANY', expect: 'allow', state: 'new' },
      { id: 'i3', requirementId: 'R3', description: 'VLAN20-IOT -> VLAN10-DATA (new)', from: 'VLAN20-IOT', to: 'VLAN10-DATA', expect: 'drop', state: 'new' },
    ]
  }, {
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
      { id: 'i1', requirementId: 'R1', description: 'DATA -> Internet (verbinding: new + established heen en terug)', from: 'DATA', to: 'Internet', expect: 'allow' },
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
      { id: 'i1', requirementId: 'R1', description: 'STAFF -> Internet (verbinding: new + established heen en terug)', from: 'STAFF', to: 'Internet', expect: 'allow' },
      { id: 'i2', requirementId: 'R2', description: 'GUEST -> Internet (verbinding: new + established heen en terug)', from: 'GUEST', to: 'Internet', expect: 'allow' },
      { id: 'i3', requirementId: 'R3', description: 'GUEST -> STAFF (new)', from: 'GUEST', to: 'STAFF', expect: 'drop' },
      { id: 'i4', requirementId: 'R4', description: 'STAFF -> GUEST (verbinding: new + established heen en terug)', from: 'STAFF', to: 'GUEST', expect: 'allow' }
    ]
  }
];

export function findScenario(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.meta.id === id);
}
