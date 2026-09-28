// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScenarioPanel } from './ScenarioPanel';

describe('ScenarioPanel wizard draft', () => {
  const openWizard = () => {
    fireEvent.click(screen.getByRole('button', { name: /Scenario laden/ }));
  };

  it('keeps a half-built scenario when the dialog is closed, and can resume or discard it', () => {
    render(<ScenarioPanel activeScenario={null} onLoadScenario={() => {}} onClearScenario={() => {}} />);

    openWizard();
    fireEvent.click(screen.getByRole('button', { name: /Nieuw scenario opbouwen/ }));
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Magazijn' } });

    // Close the dialog (Esc), as a teacher might do by accident.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(screen.queryByLabelText('Titel')).not.toBeInTheDocument();

    openWizard();
    fireEvent.click(screen.getByRole('button', { name: 'Verder met je concept: Magazijn' }));
    expect(screen.getByLabelText('Titel')).toHaveValue('Magazijn');

    // Back to the list and discard: the next wizard starts empty.
    fireEvent.click(screen.getByRole('button', { name: /Terug naar de lijst/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Concept verwijderen' }));
    fireEvent.click(screen.getByRole('button', { name: /Nieuw scenario opbouwen/ }));
    expect(screen.getByLabelText('Titel')).toHaveValue('');
  });
});

describe('ScenarioPanel pasted JSON', () => {
  const paste = (text: string) => {
    render(<ScenarioPanel activeScenario={null} onLoadScenario={() => {}} onClearScenario={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Scenario laden/ }));
    fireEvent.click(screen.getByText('Geavanceerd: JSON plakken'));
    fireEvent.change(screen.getByPlaceholderText(/"meta"/), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Scenario inladen' }));
  };

  it('says the JSON itself is invalid when it cannot be parsed', () => {
    paste('{"meta": ');
    expect(screen.getByRole('alert')).toHaveTextContent('Dit is geen geldige JSON');
  });

  it('lists what is wrong in valid JSON that is not a valid scenario, without crashing', () => {
    paste(JSON.stringify({
      meta: { id: 'x', title: 'X' },
      brief: { markdown: '', requirements: [null] },
      topology: { vlans: [null] }
    }));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Dit scenario kan niet geladen worden');
    expect(alert).toHaveTextContent('brief.requirements[0]');
    expect(alert).toHaveTextContent('topology.vlans[0]');
  });
});

