// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { WizardStepTopology } from './WizardStepTopology';
import { WizardDraft, createEmptyDraft } from '@/lib/scenarioWizard';

function Harness({ onDraft }: { onDraft: (d: WizardDraft) => void }) {
  const [draft, setDraft] = useState<WizardDraft>(createEmptyDraft());
  const update = (updates: Partial<WizardDraft>) => {
    setDraft(prev => {
      const next = { ...prev, ...updates };
      onDraft(next);
      return next;
    });
  };
  return <WizardStepTopology draft={draft} onChange={update} />;
}

describe('WizardStepTopology', () => {
  it('adds a host when clicking the "+" button', () => {
    let latest: WizardDraft | null = null;
    render(<Harness onDraft={(d) => { latest = d; }} />);

    fireEvent.click(screen.getByText('VLAN toevoegen'));
    fireEvent.change(screen.getByPlaceholderText('VLAN-naam, bv. DATA'), { target: { value: 'DATA' } });

    const hostInput = screen.getByPlaceholderText('Hostnaam toevoegen, bv. PC 1');
    fireEvent.change(hostInput, { target: { value: 'PC 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host toevoegen' }));

    expect(latest!.vlans[0].hosts).toEqual(['PC 1']);
  });

  it('adds a host on Enter', () => {
    let latest: WizardDraft | null = null;
    render(<Harness onDraft={(d) => { latest = d; }} />);

    fireEvent.click(screen.getByText('VLAN toevoegen'));
    const hostInput = screen.getByPlaceholderText('Hostnaam toevoegen, bv. PC 1');
    fireEvent.change(hostInput, { target: { value: 'Camera 1' } });
    fireEvent.keyDown(hostInput, { key: 'Enter' });

    expect(latest!.vlans[0].hosts).toEqual(['Camera 1']);
  });

  it('does not lose a typed host name that was never explicitly submitted — commits it on blur', () => {
    // Regression test: a teacher types a host name, then clicks "Volgende"
    // (moving focus away) without clicking "+" or pressing Enter first.
    // Before the onBlur fix, that text silently vanished and the exported
    // scenario's VLAN ended up with an empty hosts array.
    let latest: WizardDraft | null = null;
    render(<Harness onDraft={(d) => { latest = d; }} />);

    fireEvent.click(screen.getByText('VLAN toevoegen'));
    const hostInput = screen.getByPlaceholderText('Hostnaam toevoegen, bv. PC 1');
    fireEvent.change(hostInput, { target: { value: 'PC 1' } });
    fireEvent.blur(hostInput);

    expect(latest!.vlans[0].hosts).toEqual(['PC 1']);
  });

  it('removes a host via its remove button', () => {
    let latest: WizardDraft | null = null;
    render(<Harness onDraft={(d) => { latest = d; }} />);

    fireEvent.click(screen.getByText('VLAN toevoegen'));
    fireEvent.change(screen.getByPlaceholderText('Hostnaam toevoegen, bv. PC 1'), { target: { value: 'PC 1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Host toevoegen' }));

    fireEvent.click(screen.getByRole('button', { name: 'PC 1 verwijderen' }));

    expect(latest!.vlans[0].hosts).toEqual([]);
  });
});
