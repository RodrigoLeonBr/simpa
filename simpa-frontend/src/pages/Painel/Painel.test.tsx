import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppProvider } from '../../contexts/AppContext';
import { FiltersProvider } from '../../hooks/useFilters';
import { AUTH_STORAGE_KEY } from '../../types/auth';
import mockDb from '../../../mock/db.json';
import PainelPage from './index';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

import { useDashboard } from '../../hooks/useDashboard';

describe('Painel page', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'jwt-123',
        user: { username: 'admin', nome: 'Admin', perfil: 'Administrador' },
      }),
    );

    vi.mocked(useDashboard).mockReturnValue({
      data: mockDb.planejamento[0] as never,
      unidades: mockDb.unidades as never,
      loading: false,
      error: null,
    });
  });

  it('layout switcher changes visible panel', async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <AppProvider>
            <FiltersProvider>
              <PainelPage />
            </FiltersProvider>
          </AppProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('layout-a')).toBeInTheDocument();
    expect(screen.queryByTestId('layout-b')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'B · Foco' }));

    expect(screen.queryByTestId('layout-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('layout-b')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'C · Tabela' }));
    expect(screen.getByTestId('layout-c')).toBeInTheDocument();
  });

  it('shows loading and error states', () => {
    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: true,
      error: null,
    });

    const { rerender } = render(
      <MemoryRouter>
        <AuthProvider>
          <AppProvider>
            <FiltersProvider>
              <PainelPage />
            </FiltersProvider>
          </AppProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Carregando painel…')).toBeInTheDocument();

    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: false,
      error: 'Falha ao carregar',
    });

    rerender(
      <MemoryRouter>
        <AuthProvider>
          <AppProvider>
            <FiltersProvider>
              <PainelPage />
            </FiltersProvider>
          </AppProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument();
  });
});
