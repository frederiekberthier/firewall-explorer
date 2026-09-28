// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('kapotte render');
  return <p>Alles werkt</p>;
}

afterEach(() => vi.restoreAllMocks());

describe('ErrorBoundary', () => {
  it('shows a message instead of a blank page, and can try again', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {}); // React logs the caught error
    shouldThrow = true;
    render(<ErrorBoundary><Flaky /></ErrorBoundary>);

    expect(screen.getByRole('alert')).toHaveTextContent('Er ging iets mis in de simulator');
    expect(screen.getByText('kapotte render')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Opnieuw proberen' }));
    expect(screen.getByText('Alles werkt')).toBeInTheDocument();
  });

  it('renders its children normally when nothing goes wrong', () => {
    function Fine() {
      const [n] = useState(1);
      return <p>ok {n}</p>;
    }
    render(<ErrorBoundary><Fine /></ErrorBoundary>);
    expect(screen.getByText('ok 1')).toBeInTheDocument();
  });
});
