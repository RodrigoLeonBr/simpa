import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutB } from './LayoutB';

vi.mock('../../utils/dashboardView', () => ({
  buildPainelKpis: vi.fn(),
  buildTrendSeries: vi.fn(),
}));

vi.mock('../../components/charts/EChart', () => ({
  EChart: () => <div data-testid="layout-b-echart" />,
  heroTrendOption: vi.fn(() => ({ series: [] })),
}));

vi.mock('../../components/painel/KpiCard', () => ({
  KpiCard: ({ kpi }: { kpi: { title: string } }) => <div data-testid="layout-b-kpi">{kpi.title}</div>,
}));

vi.mock('../../components/painel/QualityBars', () => ({
  QualityBars: () => <div data-testid="layout-b-quality-bars" />,
}));

import { buildPainelKpis, buildTrendSeries } from '../../utils/dashboardView';

describe('LayoutB', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renderiza valores principais e KPIs secundários quando dados existem', () => {
    vi.mocked(buildPainelKpis).mockReturnValue([
      { id: 'hero', title: 'Atendimentos', value: '120', delta: { label: '+10%' } },
      { id: 'cobertura', title: 'Cobertura', value: '89%' },
      { id: 'equipes', title: 'Equipes', value: '45' },
      { id: 'metas', title: 'Metas', value: '7' },
      { id: 'kpi5', title: 'Secundário 2', value: '3' },
      { id: 'kpi6', title: 'Secundário 3', value: '2' },
    ]);
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
