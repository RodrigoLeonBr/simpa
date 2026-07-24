import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WidgetPreviewResult } from './WidgetPreviewResult';
import type { ResolvedPainelWidget } from '../../types/painelWidgets';
import { EM_DASH } from '../../utils/kpi';

function base(overrides: Partial<ResolvedPainelWidget>): ResolvedPainelWidget {
  return {
    slug: 'w1',
    ordem: 1,
    tipo: 'card',
    titulo: 'Widget',
    subtitulo: null,
    formato: 'numero',
    value: null,
    valueLabel: EM_DASH,
    isNull: true,
    ...overrides,
  };
}

describe('WidgetPreviewResult', () => {
  it('exibe lista de ranking quando presente', () => {
    render(
      <WidgetPreviewResult
        result={base({
          tipo: 'grafico_ranking',
          isNull: false,
          ranking: [
            { label: 'UBS A', valor: 30, valueLabel: '30' },
            { label: 'UBS B', valor: 20, valueLabel: '20' },
          ],
        })}
      />,
    );

    expect(screen.getByTestId('preview-ranking')).toBeInTheDocument();
    expect(screen.getByText('UBS A')).toBeInTheDocument();
    expect(screen.getByText('UBS B')).toBeInTheDocument();
    expect(screen.queryByTestId('preview-value')).not.toBeInTheDocument();
  });

  it('exibe série temporal quando presente', () => {
    render(
      <WidgetPreviewResult
        result={base({
          tipo: 'grafico_linha',
          isNull: false,
          series: [
            { competencia: '2026-04', valor: 10 },
            { competencia: '2026-05', valor: 15 },
          ],
        })}
      />,
    );

    expect(screen.getByTestId('preview-series')).toBeInTheDocument();
    expect(screen.getByText('2026-04')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('exibe valor escalar, delta e sparkline para card', () => {
    render(
      <WidgetPreviewResult
        result={base({
          tipo: 'card',
          isNull: false,
          value: 120,
          valueLabel: '120',
          delta: { label: '+5 vs mês anterior', direction: 'up' },
          sparkSeries: [1, 2, 3],
        })}
      />,
    );

    expect(screen.getByTestId('preview-value')).toHaveTextContent('120');
    expect(screen.getByTestId('preview-delta')).toHaveTextContent('+5 vs mês anterior');
    expect(screen.getByTestId('preview-spark')).toHaveTextContent('3 pontos');
  });
});
