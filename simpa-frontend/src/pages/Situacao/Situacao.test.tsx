import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { AppProvider, useApp } from '../../contexts/AppContext';
import { FiltersProvider } from '../../hooks/useFilters';
import { AUTH_STORAGE_KEY } from '../../types/auth';
import mockDb from '../../../mock/db.json';
import type { ContratoDashboard } from '../../types/contrato';
import { buildPainelKpis } from '../../utils/dashboardView';
import { SituacaoOverlay } from './index';

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
  situacaoTrendOption: vi.fn(() => ({})),
}));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

import { useDashboard } from '../../hooks/useDashboard';

const dashboardData = mockDb.planejamento[0] as ContratoDashboard;

function renderOverlay() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AppProvider>
          <FiltersProvider>
            <SituacaoOverlay />
          </FiltersProvider>
        </AppProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('SituacaoOverlay', () => {
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
      data: dashboardData,
      unidades: mockDb.unidades as never,
      loading: false,
      error: null,
    });
  });

  it('renders fixed fullscreen overlay above shell chrome', () => {
    renderOverlay();

    const overlay = screen.getByTestId('situacao-overlay');
    expect(overlay).toHaveClass('situacao-overlay');
    expect(overlay).toHaveAttribute('role', 'dialog');
    expect(overlay).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('SALA DE SITUAÇÃO · SIMPA')).toBeInTheDocument();
    expect(screen.getByText(/Competência 2026-05/)).toBeInTheDocument();
    expect(screen.getByText(/● ao vivo ·/)).toBeInTheDocument();
  });

  it('shows KPI values from dashboard data source', () => {
    renderOverlay();

    const kpis = buildPainelKpis(dashboardData).slice(0, 4);
    expect(screen.getByTestId('situacao-kpi-grid')).toBeInTheDocument();

    for (const kpi of kpis) {
      expect(screen.getByText(kpi.label)).toBeInTheDocument();
      expect(screen.getAllByText(kpi.value).length).toBeGreaterThan(0);
    }
  });

  it('renders trend chart and quality bars sections', () => {
    renderOverlay();

    expect(screen.getByTestId('situacao-trend-chart')).toBeInTheDocument();
    expect(screen.getByText('Componente Qualidade APS')).toBeInTheDocument();
    expect(screen.getByText(/C1/)).toBeInTheDocument();
  });

  it('closes overlay when exit button is clicked', async () => {
    function Probe() {
      const { isSituacao, openSituacao } = useApp();
      return (
        <>
          <button type="button" onClick={openSituacao}>
            open overlay
          </button>
          {isSituacao ? <SituacaoOverlay /> : null}
        </>
      );
    }

    render(
      <AppProvider>
        <FiltersProvider>
          <Probe />
        </FiltersProvider>
      </AppProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'open overlay' }));
    expect(screen.getByRole('dialog', { name: 'Sala de Situação' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '↩ Sair do telão' }));
    expect(screen.queryByRole('dialog', { name: 'Sala de Situação' })).not.toBeInTheDocument();
  });

  it('shows loading and error states', () => {
    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: true,
      error: null,
    });

    const { rerender } = renderOverlay();
    expect(screen.getByText('Carregando dados…')).toBeInTheDocument();

    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: false,
      error: 'Falha ao carregar telão',
    });

    rerender(
      <MemoryRouter>
        <AuthProvider>
          <AppProvider>
            <FiltersProvider>
              <SituacaoOverlay />
            </FiltersProvider>
          </AppProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Falha ao carregar telão')).toBeInTheDocument();
  });
});
