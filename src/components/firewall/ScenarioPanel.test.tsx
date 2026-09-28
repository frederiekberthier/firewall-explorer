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
