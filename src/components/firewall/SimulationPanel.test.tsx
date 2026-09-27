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
  const view = render(
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
  return view;
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

describe('SimulationPanel timers and cleanup', () => {
  const renderPanel = (onSimulationChange = vi.fn(), onActiveRuleChange = vi.fn()) => {
    const view = render(
      <SimulationPanel
        nodes={nodes}
        rules={[rule({ connectionStates: ['new', 'established'] })]}
        firewallPolicy="block-all"
        simulation={null}
        onSimulationChange={onSimulationChange}
        onActiveRuleChange={onActiveRuleChange}
      />
    );
    choose('Bron', 'DATA');
    choose('Doel', 'Internet');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: /Start simulatie/ }));
    return { ...view, onSimulationChange, onActiveRuleChange };
  };

  it('stays idle when reset is clicked while the first packet is still travelling', async () => {
    renderPanel();
    await act(async () => { vi.advanceTimersByTime(500); });
    fireEvent.click(screen.getByRole('button', { name: 'Simulatie resetten' }));

    for (let i = 0; i < 10; i++) {
      await act(async () => { vi.advanceTimersByTime(1500); });
    }
    expect(screen.queryByText(/Firewall regel evaluatie/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start simulatie/ })).toBeEnabled();
  });

  it('cannot start a second, overlapping run', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: /Start simulatie/ })).toBeDisabled();
  });

  it('clears the packet and the highlighted rule when the panel unmounts mid-simulation', async () => {
    const { unmount, onSimulationChange, onActiveRuleChange } = renderPanel();
    await act(async () => { vi.advanceTimersByTime(2000); });
    onSimulationChange.mockClear();
    onActiveRuleChange.mockClear();

    unmount();

    expect(onSimulationChange).toHaveBeenCalledWith(null);
    expect(onActiveRuleChange).toHaveBeenCalledWith(null);
  });
});

describe('SimulationPanel connection table', () => {
  const tableRows = () => screen.getAllByRole('row').slice(1); // skip header row
  const runAgain = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Simulatie resetten' }));
    fireEvent.click(screen.getByRole('button', { name: /Start simulatie/ }));
    for (let i = 0; i < 20; i++) {
      await act(async () => { vi.advanceTimersByTime(1500); });
    }
  };
  const working = [
    rule({ connectionStates: ['new', 'established'] }),
    rule({ id: 'r2', sourceId: 'inet', destinationId: 'data', connectionStates: ['established', 'related'], order: 1 })
  ];

  it('marks a connection whose reply was blocked as such, not as established', async () => {
    await simulate([rule({})]);
    expect(tableRows()).toHaveLength(1);
    expect(tableRows()[0]).toHaveTextContent('antwoord geblokkeerd');
  });

  it('shows the connection table lookup in the reply evaluation', async () => {
    await simulate(working);
    expect(screen.getAllByText(/Connectietabel: verbinding DATA → Internet gevonden/)).toHaveLength(2); // reply + follow-up
    expect(tableRows()[0]).toHaveTextContent('established');
  });

  it('keeps one row per connection when the same test runs again', async () => {
    await simulate(working);
    await runAgain();
    await runAgain();
    expect(tableRows()).toHaveLength(1);
  });

  it('can be cleared with the button', async () => {
    await simulate(working);
    fireEvent.click(screen.getByRole('button', { name: 'Tabel leegmaken' }));
    expect(screen.queryByText('Connectietabel')).not.toBeInTheDocument();
  });

  it('is cleared when the rules change', async () => {
    const view = await simulate(working);
    expect(screen.getByText('Connectietabel')).toBeInTheDocument();

    view.rerender(
      <SimulationPanel nodes={nodes} rules={[rule({})]} firewallPolicy="block-all" simulation={null} onSimulationChange={() => {}} />
    );
    expect(screen.queryByText('Connectietabel')).not.toBeInTheDocument();
  });
});

