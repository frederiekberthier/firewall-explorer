// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from './NotFound';

describe('NotFound', () => {
  it('is in Dutch and links back to the simulator under the app base path', () => {
    render(
      <MemoryRouter basename="/firewall" initialEntries={['/firewall/bestaat-niet']}>
        <NotFound />
      </MemoryRouter>
    );

    expect(screen.getByText('Pagina niet gevonden.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Terug naar de simulator' })).toHaveAttribute('href', '/firewall');
  });
});
