// @vitest-environment jsdom
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { SimulationPanel } from './SimulationPanel';
import { NetworkNode, FirewallRule } from '@/types/firewall';

// Radix Select relies on a few browser APIs jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const nodes: NetworkNode[] = [
  { id: 'router', type: 'router', name: 'Router', x: 0, y: 0, parentId: null },
  { id: 'inet', type: 'internet', name: 'Internet', x: 0, y: 0, parentId: 'router' },
  { id: 'data', type: 'vlan', name: 'DATA', x: 0, y: 0, parentId: 'router' }
];

const rule = (overrides: Partial<FirewallRule>): FirewallRule => ({
  id: 'r1', sourceId: 'data', destinationId: 'inet', connectionStates: ['new'], action: 'allow', order: 0, ...overrides
});

const choose = (label: string, option: string) => {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'Enter' });
  fireEvent.click(screen.getByRole('option', { name: option }));
};

async function simulate(rules: FirewallRule[]) {
  render(
    <SimulationPanel
      nodes={nodes}
      rules={rules}
      firewallPolicy="block-all"
      simulation={null}
      onSimulationChange={() => {}}
    />
  );
  choose('Bron', 'DATA');
  choose('Doel', 'Internet');

  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: /Start simulatie/ }));
  // Enough ticks for three stages of travel (1.5 s) and rule checks (1.2 s each).
  for (let i = 0; i < 20; i++) {
    await act(async () => { vi.advanceTimersByTime(1500); });
  }
}

describe('SimulationPanel connection stages', () => {
  it('evaluates the reply in its real direction and explains a missing reply rule', async () => {
    // Old habit: the established rule in the request direction does not cover the reply.
    await simulate([rule({}), rule({ id: 'r2', connectionStates: ['established', 'related'], order: 1 })]);

    expect(screen.getByText(/antwoord \(established\): Internet → DATA/)).toBeInTheDocument();
    expect(screen.getByText(/het antwoord \(Internet → DATA\) werd geblokkeerd/)).toBeInTheDocument();
    expect(screen.getByText(/Communicatie GEBLOKKEERD/)).toBeInTheDocument();
  });

  it('blocks the connection when only the reply direction has an established rule', async () => {
    await simulate([rule({}), rule({ id: 'r2', sourceId: 'inet', destinationId: 'data', connectionStates: ['established'], order: 1 })]);

    expect(screen.getByText(/vervolgpakketten \(established\): DATA → Internet/)).toBeInTheDocument();
    expect(screen.getByText(/vervolgpakketten van DATA \(DATA → Internet, established\) werden geblokkeerd/)).toBeInTheDocument();
  });

  it('allows the connection when request, reply and follow-up all pass', async () => {
    await simulate([
      rule({ connectionStates: ['new', 'established'] }),
      rule({ id: 'r2', sourceId: 'inet', destinationId: 'data', connectionStates: ['established', 'related'], order: 1 })
    ]);

    expect(screen.getByText(/Communicatie TOEGESTAAN/)).toBeInTheDocument();
  });
});
