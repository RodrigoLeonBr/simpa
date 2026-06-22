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

vi.mock('../../components/charts/LazyEChart', () => ({
  EChart: ({ testId }: { testId?: string }) => <div data-testid={testId ?? 'mock-echart'} />,
  sparklineOption: vi.fn(() => ({})),
  trendOption: vi.fn(() => ({})),
  heroTrendOption: vi.fn(() => ({})),
}));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

import { useDashboard } from '../../hooks/useDashboard';

function renderPainel() {
  return render(
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
}

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

  it('renders layout-a for default APS perfil', () => {
    renderPainel();

    expect(screen.getByTestId('layout-a')).toBeInTheDocument();
    expect(screen.queryByTestId('painel-profile-placeholder')).not.toBeInTheDocument();
  });

  it('renders placeholder instead of APS KPI grid for Hospitalar perfil', async () => {
    const user = userEvent.setup();
    renderPainel();

    await user.click(screen.getByRole('button', { name: 'Hospitalar' }));

    expect(screen.getByTestId('painel-profile-placeholder')).toBeInTheDocument();
    expect(screen.queryByTestId('layout-a')).not.toBeInTheDocument();
    expect(screen.queryByText('Atendimentos individuais')).not.toBeInTheDocument();
  });

  it('layout switcher changes visible panel under APS', async () => {
    const user = userEvent.setup();
    renderPainel();

    expect(screen.getByTestId('layout-a')).toBeInTheDocument();
    expect(screen.queryByTestId('layout-b')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'B · Foco' }));

    expect(screen.queryByTestId('layout-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('layout-b')).toBeInTheDocument();
    expect(screen.getByText(/Atendimentos individuais/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'C · Tabela' }));
    expect(screen.getByTestId('layout-c')).toBeInTheDocument();
  });

  it('shows loading and error states for APS catalog', () => {
    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: true,
      error: null,
    });

    const { rerender } = renderPainel();

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
