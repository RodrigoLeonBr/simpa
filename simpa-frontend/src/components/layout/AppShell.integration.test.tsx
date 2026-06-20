import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppProvider } from '../../contexts/AppContext';
import { FiltersProvider } from '../../hooks/useFilters';
import { AUTH_STORAGE_KEY } from '../../types/auth';
import { AppShell } from './AppShell';

function HomePage() {
  return <div>shell-home</div>;
}

describe('AppShell integration', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'jwt-123',
        user: { username: 'admin', nome: 'Administrador SIMPA', perfil: 'Administrador' },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/cadastros/unidades')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: 1, codigo: 'CAFI001', nome: 'CAFI', tipo: 'APS', status: 'ativo' },
            ],
          });
        }
        if (url.includes('/cadastros/equipes')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: 1, codigo: '0001', nome: 'EQUIPE 9 EAP', tipo: 'EAP', unidade_id: 1, status: 'ativo' },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }),
    );
  });

  it('renders shell chrome for authenticated user', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <AppProvider>
            <FiltersProvider>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/" element={<HomePage />} />
                </Route>
              </Routes>
            </FiltersProvider>
          </AppProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('shell-home')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Módulos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Painel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sala de Situação/i })).toBeInTheDocument();
    expect(screen.getByText('Administrador SIMPA')).toBeInTheDocument();
    expect(screen.getByLabelText('Competência')).toBeInTheDocument();
  });

  it('opens situacao overlay from topbar button', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <AuthProvider>
          <AppProvider>
            <FiltersProvider>
              <Routes>
                <Route element={<AppShell />}>
                  <Route path="/admin" element={<div>admin-page</div>} />
                </Route>
              </Routes>
            </FiltersProvider>
          </AppProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('admin-page')).toBeInTheDocument();
    expect(screen.queryByLabelText('Competência')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Sala de Situação/i }));
    expect(screen.getByRole('dialog', { name: 'Sala de Situação' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog', { name: 'Sala de Situação' })).not.toBeInTheDocument();
  });
});
