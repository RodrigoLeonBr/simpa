import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDosesResumo, fetchDosesFiltros } from '../../api/vacina';
import { DosesReport } from './DosesReport';

vi.mock('../../api/vacina', async () => {
  const actual = await vi.importActual<typeof import('../../api/vacina')>('../../api/vacina');
  return { ...actual, fetchDosesResumo: vi.fn(), fetchDosesFiltros: vi.fn() };
});

const mockResumo = vi.mocked(fetchDosesResumo);
const mockFiltros = vi.mocked(fetchDosesFiltros);

const sampleResumo = {
  ano: 2026,
  mes: 3,
  total_doses_mes: 300,
  total_doses_ano: 600,
  serie_mensal: [
    { competencia: '2026-01', doses: 100 },
    { competencia: '2026-02', doses: 200 },
    { competencia: '2026-03', doses: 300 },
  ],
  por_vacina: [{ imuno_codigo: '85', imuno_nome: 'BCG', doses: 350 }],
  por_faixa: [{ faixa_nies: '< 01 ano', doses: 250 }],
  por_unidade: [{ cnes_sala: '4032128', sala_nome: 'UBS A', doses: 600 }],
  por_sistema: [{ sistema_origem: 'NOVO PNI', doses: 600 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFiltros.mockResolvedValue({ anos: [2026], salas: [{ cnes_sala: '4032128', sala_nome: 'UBS A' }] });
  mockResumo.mockResolvedValue(sampleResumo);
});

afterEach(() => cleanup());

describe('DosesReport', () => {
  it('renders KPIs and chart containers after load', async () => {
    render(<DosesReport />);
    await waitFor(() => expect(screen.getByTestId('doses-kpi-ano')).toHaveTextContent('600'));
    expect(screen.getByTestId('doses-kpi-mes')).toHaveTextContent('300');
    expect(screen.getByTestId('doses-chart-serie')).toBeInTheDocument();
    expect(screen.getByTestId('doses-chart-vacina')).toBeInTheDocument();
    expect(screen.getByTestId('doses-chart-faixa')).toBeInTheDocument();
    expect(screen.getByTestId('doses-chart-unidade')).toBeInTheDocument();
    expect(screen.getByTestId('doses-chart-sistema')).toBeInTheDocument();
  });
});
