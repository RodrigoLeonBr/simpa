import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppProvider } from '../../contexts/AppContext';
import { AUTH_STORAGE_KEY } from '../../types/auth';
import { Topbar } from './Topbar';

describe('Topbar', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'jwt-123',
        user: { username: 'admin', nome: 'Planejamento', perfil: 'Gestor Secretaria' },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );
  });

  it('shows profile data and triggers situacao/logout actions', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <AppProvider>
            <Topbar title="Painel" crumb="Dashboard" />
          </AppProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Planejamento')).toBeInTheDocument();
    expect(screen.getByText('Gestor Secretaria')).toBeInTheDocument();
    expect(screen.getByText('PL')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Sala de Situação/i }));
    await userEvent.click(screen.getByTitle('Sair'));

    expect(fetch).toHaveBeenCalled();
  });
});
