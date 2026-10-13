import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DynamicWidgetGrid } from './DynamicWidgetGrid';
import type { ResolvedPainelWidget } from '../../types/painelWidgets';

vi.mock('../charts/LazyEChart', () => ({
  EChart: () => <div data-testid="echart" />,
  trendOption: () => ({}),
  competenciaMesAno: (c: string) => c,
}));

const card: ResolvedPainelWidget = {
  slug: 'c1', ordem: 1, tipo: 'card', titulo: 'Doses', subtitulo: null,
  formato: 'numero', value: 123, valueLabel: '123', isNull: false,
} as ResolvedPainelWidget;

describe('DynamicWidgetGrid', () => {
  it('renderiza cards e usa testId custom', () => {
    render(<DynamicWidgetGrid widgets={[card]} testId="vacinas-indicadores-grid" />);
    expect(screen.getByTestId('vacinas-indicadores-grid')).toBeInTheDocument();
    expect(screen.getByText('Doses')).toBeInTheDocument();
  });

  it('lista vazia não quebra', () => {
    render(<DynamicWidgetGrid widgets={[]} testId="empty-grid" />);
    expect(screen.getByTestId('empty-grid')).toBeInTheDocument();
  });
});
