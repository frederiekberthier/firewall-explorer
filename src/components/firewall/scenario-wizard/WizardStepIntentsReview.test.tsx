// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardStepIntentsReview } from './WizardStepIntentsReview';
import { WizardDraft } from '@/lib/scenarioWizard';

const draft: WizardDraft = {
  title: 'T', markdown: 'M', difficulty: 'basis',
  requirements: [{ key: 'k1', text: 'DATA mag naar internet' }, { key: 'k2', text: 'SEC mag naar internet' }],
  internet: true,
  // "DATA" was renamed to "KANTOOR" in step 3 after step 4 was filled in.
  vlans: [{ key: 'v1', name: 'KANTOOR', hosts: [] }, { key: 'v2', name: 'SEC', hosts: [] }],
  intentChoices: {
    k1: { from: 'DATA', to: 'Internet', expect: 'allow', state: 'new' },
    k2: { from: 'SEC', to: 'Internet', expect: 'allow', state: 'new' }
  }
};

describe('WizardStepIntentsReview stale choices', () => {
  it('marks only the requirement that points at a removed element, naming it', () => {
    render(<WizardStepIntentsReview draft={draft} onChange={() => {}} />);
    const warnings = screen.getAllByText(/bestaat niet meer in\s+de topologie/);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveTextContent('"DATA"');
    // The stale bron is shown empty, so the placeholder asks for a new pick.
    expect(screen.getByText('Bron...')).toBeInTheDocument();
  });
});
