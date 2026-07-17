import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import mockDb from '../../../mock/db.json';
import { FiltersProvider } from '../../hooks/useFilters';
import { LayoutA } from './LayoutA';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../../components/charts/LazyEChart', () => ({
  EChart: ({ testId }: { testId?: string }) => <div data-testid={testId} />,
  trendOption: vi.fn(() => ({})),
  sparklineOption: vi.fn(() => ({})),
}));

vi.mock('../../hooks/usePainelLayout', () => ({
  usePainelLayout: vi.fn(),
}));

import { usePainelLayout } from '../../hooks/usePainelLayout';

function renderLayoutA() {
  return render(
    <FiltersProvider>
      <LayoutA data={mockDb.planejamento[0] as never} unidades={mockDb.unidades as never} />
    </FiltersProvider>,
  );
}

describe('LayoutA dynamic widgets', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza 6 KpiCard com layout dinâmico', () => {
    vi.mocked(usePainelLayout).mockReturnValue({
      layout: {
        perfil: 'APS',
        layout: 'A',
        competencia: '2026-05',
        widgets: [
          { slug: 'k1', ordem: 1, tipo: 'card', titulo: 'K1', subtitulo: null, formato: 'numero', value: 1, valueLabel: '1', isNull: false },
          { slug: 'k2', ordem: 2, tipo: 'card', titulo: 'K2', subtitulo: null, formato: 'numero', value: 2, valueLabel: '2', isNull: false },
          { slug: 'k3', ordem: 3, tipo: 'card', titulo: 'K3', subtitulo: null, formato: 'numero', value: 3, valueLabel: '3', isNull: false },
          { slug: 'k4', ordem: 4, tipo: 'card', titulo: 'K4', subtitulo: null, formato: 'numero', value: 4, valueLabel: '4', isNull: false },
          { slug: 'k5', ordem: 5, tipo: 'card', titulo: 'K5', subtitulo: null, formato: 'numero', value: 5, valueLabel: '5', isNull: false },
          { slug: 'k6', ordem: 6, tipo: 'card', titulo: 'K6', subtitulo: null, formato: 'numero', value: 6, valueLabel: '6', isNull: false },
          {
            slug: 'trend',
            ordem: 7,
            tipo: 'grafico_linha',
            titulo: 'Tendência dinâmica',
            subtitulo: null,
            formato: 'numero',
            value: null,
            valueLabel: '—',
            isNull: true,
            series: [
              { competencia: '2026-04', valor: 12 },
              { competencia: '2026-05', valor: 15 },
            ],
          },
          {
            slug: 'rank',
            ordem: 8,
            tipo: 'grafico_ranking',
            titulo: 'Ranking dinâmico',
            subtitulo: null,
            formato: 'numero',
            value: null,
            valueLabel: '—',
            isNull: true,
            ranking: [
              { label: 'UBS A', valor: 30, valueLabel: '30' },
              { label: 'UBS B', valor: 20, valueLabel: '20' },
            ],
          },
        ],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    const { container } = renderLayoutA();

    expect(screen.getByTestId('layout-a')).toBeInTheDocument();
    expect(container.querySelectorAll('.kpi-card')).toHaveLength(6);
    expect(screen.getByText('Tendência dinâmica')).toBeInTheDocument();
    expect(screen.getByText('Ranking dinâmico')).toBeInTheDocument();
  });

  it('renderiza EChart quando widget de linha possui série', () => {
    vi.mocked(usePainelLayout).mockReturnValue({
      layout: {
        perfil: 'APS',
        layout: 'A',
        competencia: '2026-05',
        widgets: [
          { slug: 'k1', ordem: 1, tipo: 'card', titulo: 'K1', subtitulo: null, formato: 'numero', value: 1, valueLabel: '1', isNull: false },
          {
            slug: 'trend',
            ordem: 2,
            tipo: 'grafico_linha',
            titulo: 'Linha API',
            subtitulo: null,
            formato: 'numero',
            value: null,
            valueLabel: '—',
            isNull: true,
            series: [{ competencia: '2026-05', valor: 15 }],
          },
        ],
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderLayoutA();

    expect(screen.getAllByTestId('trend-chart').length).toBeGreaterThan(0);
  });

  it('faz fallback para builders legados quando layout falha', () => {
    vi.mocked(usePainelLayout).mockReturnValue({
      layout: null,
      loading: false,
      error: 'Falha API',
      refetch: vi.fn(),
    } as never);

    renderLayoutA();

    expect(screen.getAllByText('Atendimentos individuais').length).toBeGreaterThan(0);
    expect(screen.getByText('Cobertura APS')).toBeInTheDocument();
  });
});
