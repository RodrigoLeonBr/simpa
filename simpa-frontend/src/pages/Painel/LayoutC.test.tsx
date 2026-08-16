import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ContratoDashboard, Unidade } from '../../types/contrato';
import mockDb from '../../../mock/db.json';
import { LayoutC } from './LayoutC';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

const usePainelLayoutMock = vi.fn();
vi.mock('../../hooks/usePainelLayout', () => ({
  usePainelLayout: () => usePainelLayoutMock(),
}));

describe('LayoutC', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders static unit table when no dynamic widgets (fallback)', () => {
    usePainelLayoutMock.mockReturnValue({ loading: false, layout: { widgets: [] } });

    render(
      <LayoutC
        data={mockDb.planejamento[0] as ContratoDashboard}
        unidades={mockDb.unidades as Unidade[]}
      />,
    );

    expect(screen.getByTestId('layout-c')).toBeInTheDocument();
    expect(screen.getByText('Desempenho por unidade · competência 2026-05')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('renders dynamic ranking widgets as tables', () => {
    usePainelLayoutMock.mockReturnValue({
      loading: false,
      layout: {
        competencia: '2026-06',
        widgets: [
          {
            slug: 'ranking_cid_c',
            ordem: 2,
            tipo: 'grafico_ranking',
            titulo: 'Internações por CID',
            subtitulo: 'Top 10',
            ranking: [
              { label: 'A', valor: 50, valueLabel: '50' },
              { label: 'B', valor: 30, valueLabel: '30' },
            ],
          },
        ],
      },
    });

    render(<LayoutC data={null} unidades={[]} />);

    expect(screen.getByTestId('layout-c')).toBeInTheDocument();
    expect(screen.getByText('Internações por CID · competência 2026-06')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('renders nothing when no widgets and no consolidated data', () => {
    usePainelLayoutMock.mockReturnValue({ loading: false, layout: { widgets: [] } });

    const { container } = render(<LayoutC data={null} unidades={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
