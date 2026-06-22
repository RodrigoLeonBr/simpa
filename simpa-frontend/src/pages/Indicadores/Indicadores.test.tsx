import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { IndicadorQualidade } from '../../types/contrato';
import IndicadoresPage from './index';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

vi.mock('../../components/charts/LazyEChart', () => ({
  EChart: ({ testId }: { testId?: string }) => (
    <div data-testid={testId ?? 'indicador-history-chart'} />
  ),
  indicadorHistoryOption: vi.fn(() => ({})),
}));

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

import { useDashboard } from '../../hooks/useDashboard';

const indicadores: IndicadorQualidade[] = [
  {
    cod: 'B1',
    nomeCurto: 'Pré-natal',
    nome: 'Proporção de gestantes com pelo menos 6 consultas de pré-natal',
    categoria: 'Componente Qualidade APS',
    meta: 0.6,
    exec: 0.58,
    num: '1.412',
    den: '2.434',
    fonte: 'e-SUS · Atend. Individual',
    periodicidade: 'Quadrimestral',
  },
  {
    cod: 'B2',
    nomeCurto: 'Sífilis e HIV',
    nome: 'Proporção de gestantes com exames de sífilis e HIV solicitados',
    categoria: 'Componente Qualidade APS',
    meta: 0.6,
    exec: 0.71,
    num: '1.728',
    den: '2.434',
    fonte: 'e-SUS · Atend. Individual',
    periodicidade: 'Quadrimestral',
  },
];

describe('Indicadores page', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        filtros_ativos: { unidade: 'CAFI', equipe: 'EQUIPE 9 EAP' },
        indicadores_qualidade: indicadores,
      } as never,
      unidades: [
        { id: 1, codigo: 'CAFI001', nome: 'CAFI', tipo: 'APS', status: 'ativo' },
        { id: 2, codigo: 'UBS002', nome: 'UBS JARDIM SAO PAULO', tipo: 'APS', status: 'ativo' },
      ] as never,
      loading: false,
      error: null,
    });
  });

  it('updates detail panel when catalog item is selected', async () => {
    render(
      <MemoryRouter>
        <IndicadoresPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 3, name: indicadores[0]!.nome })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /B2/i }));
    expect(screen.getByRole('heading', { level: 3, name: indicadores[1]!.nome })).toBeInTheDocument();
    expect(screen.getByText('meta 60,0% · atingida')).toBeInTheDocument();
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
        <IndicadoresPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Carregando indicadores…')).toBeInTheDocument();

    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: false,
      error: 'Falha ao carregar',
    });

    rerender(
      <MemoryRouter>
        <IndicadoresPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument();
  });
});
