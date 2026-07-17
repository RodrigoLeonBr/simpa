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

vi.mock('../../hooks/usePainelLayout', () => ({
  usePainelLayout: vi.fn(() => ({
    layout: {
      perfil: 'MAC',
      layout: 'A',
      competencia: '2026-05',
      widgets: [
        {
          slug: 'sia_valor_aprovado',
          ordem: 1,
          tipo: 'card',
          titulo: 'Valor aprovado',
          subtitulo: null,
          formato: 'moeda',
          value: 1000,
          valueLabel: 'R$ 1.000,00',
          isNull: false,
        },
      ],
    },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
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

  it('renders Layout A for Hospitalar perfil (catalog ready since task_08)', async () => {
    const user = userEvent.setup();
    renderPainel();

    await user.click(screen.getByRole('button', { name: 'Hospitalar' }));

    expect(screen.getByTestId('layout-a')).toBeInTheDocument();
    expect(screen.queryByTestId('painel-profile-placeholder')).not.toBeInTheDocument();
  });

  it('renders Layout A for MAC perfil with dynamic widgets', async () => {
    const user = userEvent.setup();
    renderPainel();

    await user.click(screen.getByRole('button', { name: 'MAC' }));

    expect(screen.getByTestId('layout-a')).toBeInTheDocument();
    expect(screen.queryByTestId('painel-profile-placeholder')).not.toBeInTheDocument();
  });

  it('renders MAC Layout A without consolidated e-SUS data', async () => {
    vi.mocked(useDashboard).mockReturnValue({
      data: null,
      unidades: [{ id: 1, nome: 'Hospital MAC', tipo: 'MAC' } as never],
      loading: false,
      error: null,
    });

    const user = userEvent.setup();
    renderPainel();

    await user.click(screen.getByRole('button', { name: 'MAC' }));

    expect(screen.getByTestId('layout-a')).toBeInTheDocument();
    expect(screen.queryByText(/Dados não encontrados para os filtros informados/i)).not.toBeInTheDocument();
    expect(screen.getByText('Valor aprovado')).toBeInTheDocument();
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
});
