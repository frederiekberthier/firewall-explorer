// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { useEffect } from 'react';
import { RuleEditor } from './RuleEditor';
import { useNetworkState } from '@/hooks/useNetworkState';

// Real state hook, so moving a rule goes through the actual reorderRules.
function Harness() {
  const state = useNetworkState();
  const { addNode, addRule, nodes, rules } = state;

  useEffect(() => {
    if (nodes.length === 1) {
      addNode('vlan');
      addNode('vlan');
    }
  }, [nodes.length, addNode]);

  useEffect(() => {
    const vlans = nodes.filter(n => n.type === 'vlan');
    if (vlans.length === 2 && rules.length === 0) {
      addRule({ sourceId: vlans[0].id, destinationId: vlans[1].id, connectionStates: ['new'], action: 'allow' });
    } else if (vlans.length === 2 && rules.length === 1) {
      addRule({ sourceId: vlans[1].id, destinationId: vlans[0].id, connectionStates: ['new'], action: 'drop' });
    }
  }, [nodes, rules.length, addRule]);

  return (
    <RuleEditor
      nodes={state.nodes}
      rules={state.rules}
      firewallPolicy={state.firewallPolicy}
      addressLists={state.addressLists}
      onPolicyChange={state.setFirewallPolicy}
      onAddRule={state.addRule}
      onDeleteRule={state.deleteRule}
      onReorderRules={state.reorderRules}
      onAddAddressList={state.addAddressList}
      onDeleteAddressList={state.deleteAddressList}
    />
  );
}

const ruleActions = () =>
  screen.getAllByRole('button', { name: /^Regel \d+ verwijderen$/ }).map(button => {
    const row = button.parentElement as HTMLElement;
    return within(row).getByText(/^(allow|drop|reject)$/).textContent;
  });

describe('RuleEditor rule reordering without drag-and-drop', () => {
  beforeEach(() => {
    render(<Harness />);
  });

  it('disables "up" on the first rule and "down" on the last rule', () => {
    expect(screen.getByRole('button', { name: 'Regel 1 omhoog verplaatsen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Regel 2 omlaag verplaatsen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Regel 1 omlaag verplaatsen' })).toBeEnabled();
  });

  it('moves a rule down and back up, keeping focus on the moved rule', () => {
    expect(ruleActions()).toEqual(['allow', 'drop']);

    fireEvent.click(screen.getByRole('button', { name: 'Regel 1 omlaag verplaatsen' }));
    expect(ruleActions()).toEqual(['drop', 'allow']);
    // The moved rule is now last, so "down" is disabled and focus falls back to "up".
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Regel 2 omhoog verplaatsen' }));
    expect(screen.getByText('Regel 1 verplaatst naar positie 2 van 2.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Regel 2 omhoog verplaatsen' }));
    expect(ruleActions()).toEqual(['allow', 'drop']);
  });

  it('associates the form labels with their controls', () => {
    expect(screen.getByLabelText('Bron')).toBeInTheDocument();
    expect(screen.getByLabelText('Doel')).toBeInTheDocument();
    expect(screen.getByLabelText('Actie')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Connection state(s)' })).toBeInTheDocument();
  });
});

describe('RuleEditor rule list help text', () => {
  const renderWithPolicy = (firewallPolicy: 'block-all' | 'allow-all') => {
    const noop = () => {};
    render(
      <RuleEditor
        nodes={[]}
        rules={[]}
        firewallPolicy={firewallPolicy}
        addressLists={[]}
        onPolicyChange={noop}
        onAddRule={noop}
        onDeleteRule={noop}
        onReorderRules={noop}
        onAddAddressList={noop}
        onDeleteAddressList={noop}
      />
    );
    return screen.getByText(/Matcht geen enkele regel, dan geldt je default policy/);
  };

  it('names the chosen default policy instead of always saying "allow"', () => {
    expect(renderWithPolicy('block-all')).toHaveTextContent('default policy: Block All.');
  });

  it('follows an Allow All policy too', () => {
    expect(renderWithPolicy('allow-all')).toHaveTextContent('default policy: Allow All.');
  });
});
