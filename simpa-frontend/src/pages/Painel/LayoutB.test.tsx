import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutB } from './LayoutB';

vi.mock('../../utils/dashboardView', () => ({
  buildPainelKpis: vi.fn(),
  buildTrendSeries: vi.fn(),
}));

vi.mock('../../components/charts/LazyEChart', () => ({
  EChart: () => <div data-testid="layout-b-echart" />,
  heroTrendOption: vi.fn(() => ({ series: [] })),
  trendOption: vi.fn(() => ({ series: [] })),
}));

vi.mock('../../components/painel/KpiCard', () => ({
  KpiCard: ({ kpi }: { kpi: { title?: string; label?: string } }) => (
    <div data-testid="layout-b-kpi">{kpi.title ?? kpi.label}</div>
  ),
}));

vi.mock('../../components/painel/QualityBars', () => ({
  QualityBars: () => <div data-testid="layout-b-quality-bars" />,
}));

const usePainelLayoutMock = vi.fn();
vi.mock('../../hooks/usePainelLayout', () => ({
  usePainelLayout: () => usePainelLayoutMock(),
}));

import { buildPainelKpis, buildTrendSeries } from '../../utils/dashboardView';

describe('LayoutB', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('fallback consolidado (sem widgets dinâmicos)', () => {
    beforeEach(() => {
      // usePainelLayout sem widgets → fallback consolidado
      usePainelLayoutMock.mockReturnValue({ loading: false, layout: { widgets: [] } });
    });

    it('renderiza valores principais e KPIs secundários quando dados existem', () => {
      vi.mocked(buildPainelKpis).mockReturnValue([
        { id: 'hero', title: 'Atendimentos', value: '120', delta: { label: '+10%' } },
        { id: 'cobertura', title: 'Cobertura', value: '89%' },
        { id: 'equipes', title: 'Equipes', value: '45' },
        { id: 'metas', title: 'Metas', value: '7' },
        { id: 'kpi5', title: 'Secundário 2', value: '3' },
        { id: 'kpi6', title: 'Secundário 3', value: '2' },
      ] as never);
      vi.mocked(buildTrendSeries).mockReturnValue([{ atendimentos: 10 }, { atendimentos: 20 }] as never);

      render(<LayoutB data={{ competencia: '2026-05' } as never} unidades={[]} />);

      expect(screen.getByTestId('layout-b')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('+10%')).toBeInTheDocument();
      expect(screen.getByText('89%')).toBeInTheDocument();
      expect(screen.getAllByTestId('layout-b-kpi')).toHaveLength(3);
      expect(screen.getByTestId('layout-b-echart')).toBeInTheDocument();
      expect(screen.getByTestId('layout-b-quality-bars')).toBeInTheDocument();
    });

    it('faz fallback para traço quando KPIs principais não existem', () => {
      vi.mocked(buildPainelKpis).mockReturnValue([] as never);
      vi.mocked(buildTrendSeries).mockReturnValue([] as never);

      render(<LayoutB data={{ competencia: '2026-05' } as never} unidades={[]} />);

      expect(screen.getByText('Atendimentos individuais · 2026-05')).toBeInTheDocument();
      expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
      expect(screen.queryAllByTestId('layout-b-kpi')).toHaveLength(0);
    });
  });

  it('exibe todos os widgets dinâmicos cadastrados (cards, linhas e rankings)', () => {
    usePainelLayoutMock.mockReturnValue({
      loading: false,
      layout: {
        widgets: [
          { slug: 'c1', ordem: 1, tipo: 'card', titulo: 'Card 1', valueLabel: '10' },
          { slug: 'c2', ordem: 2, tipo: 'card', titulo: 'Card 2', valueLabel: '20' },
          { slug: 'c3', ordem: 3, tipo: 'card', titulo: 'Card 3', valueLabel: '30' },
          { slug: 'l1', ordem: 4, tipo: 'grafico_linha', titulo: 'Linha 1', series: [] },
          {
            slug: 'r1',
            ordem: 5,
            tipo: 'grafico_ranking',
            titulo: 'Ranking 1',
            ranking: [{ label: 'A', valor: 5, valueLabel: '5' }],
          },
          {
            slug: 'r2',
            ordem: 6,
            tipo: 'grafico_barra',
            titulo: 'Ranking 2',
            ranking: [{ label: 'B', valor: 3, valueLabel: '3' }],
          },
        ],
      },
    });

    render(<LayoutB data={{ competencia: '2026-05' } as never} unidades={[]} />);

    expect(screen.getAllByTestId('layout-b-kpi')).toHaveLength(3);
    expect(screen.getByText('Linha 1')).toBeInTheDocument();
    expect(screen.getByText('Ranking 1')).toBeInTheDocument();
    expect(screen.getByText('Ranking 2')).toBeInTheDocument();
  });
});
