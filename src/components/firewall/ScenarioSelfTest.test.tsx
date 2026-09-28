// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScenarioSelfTest } from './ScenarioSelfTest';
import { NetworkNode } from '@/types/firewall';
import { Scenario } from '@/types/scenario';

const nodes: NetworkNode[] = [
  { id: 'router', type: 'router', name: 'Router', x: 0, y: 0, parentId: null },
  { id: 'inet', type: 'internet', name: 'Internet', x: 0, y: 0, parentId: 'router' },
  { id: 'data', type: 'vlan', name: 'DATA', x: 0, y: 0, parentId: 'router' },
  { id: 'sec', type: 'vlan', name: 'SEC', x: 0, y: 0, parentId: 'router' }
];

// Hand-written style: R1 has two checks, one of which fails with no rules.
const scenario: Scenario = {
  meta: { id: 's', title: 'S' },
  brief: { markdown: '', requirements: [{ id: 'R1', text: 'DATA mag enkel naar internet' }, { id: 'R2', text: 'SEC mag niet naar DATA' }] },
  topology: { internet: true, vlans: [{ name: 'DATA' }, { name: 'SEC' }] },
  intents: [
    { id: 'i1', requirementId: 'R1', description: 'DATA niet naar SEC', from: 'DATA', to: 'SEC', expect: 'drop', state: 'new' },
    { id: 'i2', requirementId: 'R1', description: 'DATA naar Internet', from: 'DATA', to: 'Internet', expect: 'allow', state: 'new' },
    { id: 'i3', requirementId: 'R2', description: 'SEC niet naar DATA', from: 'SEC', to: 'DATA', expect: 'drop', state: 'new' }
  ]
};

describe('ScenarioSelfTest', () => {
  it('counts requirements in the badge, consistent with the list', () => {
    const { container } = render(<ScenarioSelfTest scenario={scenario} nodes={nodes} rules={[]} firewallPolicy="block-all" />);
    // R1 fails (one of its two checks), R2 passes: 1 of 2 requirements.
    expect(screen.getByText('1/2 voldaan')).toBeInTheDocument();
    expect(container.querySelector('li[data-status="fail"]')).toHaveTextContent('R1');
    expect(container.querySelector('li[data-status="pass"]')).toHaveTextContent('R2');
    // The failing check is shown with its own description and reason.
    expect(screen.getByText(/^DATA naar Internet: /)).toBeInTheDocument();
    expect(screen.getByText('(1/2 controles)')).toBeInTheDocument();
  });

  it('is neutral, not failing, for a scenario without automatic checks', () => {
    const { container } = render(
      <ScenarioSelfTest scenario={{ ...scenario, intents: [] }} nodes={nodes} rules={[]} firewallPolicy="block-all" />
    );
    expect(screen.queryByText(/voldaan$/)).not.toBeInTheDocument();
    expect(screen.getByText(/geen automatische controles/)).toBeInTheDocument();
    expect(container.firstElementChild?.className).not.toContain('destructive');
  });
});
