import { Phase } from '@/types/firewall';

/** The three phases of the simulator: tab label, short label (narrow screens) and page title. */
export const PHASES: { phase: Phase; label: string; short: string; title: string }[] = [
  { phase: 1, label: 'Netwerk opbouw', short: 'Netwerk', title: 'Netwerk opbouwen' },
  { phase: 2, label: 'Firewall regels', short: 'Regels', title: 'Firewallregels opstellen' },
  { phase: 3, label: 'Simulatie', short: 'Simulatie', title: 'Verkeer simuleren' }
];
