import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PopulacaoPage, {
  buildConditionsData,
  buildPyramidSeries,
} from './PopulacaoPage';

// ── Global mocks ──────────────────────────────────────────────────────────────

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({ setOption: vi.fn(), resize: vi.fn(), dispose: vi.fn() })),
}));

vi.mock('../../components/charts/LazyEChart', () => ({
  EChart: ({ testId }: { testId?: string }) => <div data-testid={testId} />,
}));

vi.mock('../../api/populacao', () => ({
  fetchPopulacao: vi.fn(),
  fetchPopulacaoCompetencias: vi.fn(),
}));

vi.mock('../../hooks/useFilters', () => ({
  useFilters: vi.fn(),
}));

import { fetchPopulacao, fetchPopulacaoCompetencias } from '../../api/populacao';
import { useFilters } from '../../hooks/useFilters';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAIXAS_ALVORADA = [
  { faixa: 'Menos de 01 ano', masculino: 31, feminino: 26 },
  { faixa: '01 ano', masculino: 19, feminino: 16 },
  { faixa: '05 a 09 anos', masculino: 108, feminino: 113 },
  { faixa: '10 a 14 anos', masculino: 109, feminino: 102 },
  { faixa: '80 anos ou mais', masculino: 31, feminino: 42 },
];

const CONDICOES_ALVORADA = {
  gestante: { sim: 24, nao: 284, nao_informado: 3029 },
  hipertensao: { sim: 313, nao: 603, nao_informado: 2421 },
  diabetes: { sim: 123, nao: 762, nao_informado: 2452 },
  fumante: { sim: 38, nao: 721, nao_informado: 2578 },
};

const MOCK_DATA = {
  competencia: '2026-01',
  total_cidadaos_ativos: 3337,
  total_saidas: 1198,
  por_unidade: [
    {
      estabelecimento_id: 5,
      estabelecimento_nome: 'PSF JD Alvorada',
      cidadaos_ativos: 3337,
      saidas: 1198,
      importado_em: '2026-06-22T14:30:00Z',
    },
  ],
  faixa_etaria: FAIXAS_ALVORADA,
  condicoes_saude: CONDICOES_ALVORADA,
  raca_cor: { branca: 2570 },
};

// ── Unit tests: buildPyramidSeries ────────────────────────────────────────────

describe('buildPyramidSeries', () => {
  it('returns reversed categories with negative masculino values', () => {
    const result = buildPyramidSeries(FAIXAS_ALVORADA);
    expect(result.categories[0]).toBe('80 anos ou mais');
    expect(result.categories[result.categories.length - 1]).toBe('Menos de 01 ano');
    expect(result.masculino.every((v) => v <= 0)).toBe(true);
  });

  it('"Menos de 01 ano" masculino value is -31', () => {
    const result = buildPyramidSeries(FAIXAS_ALVORADA);
    const idx = result.categories.indexOf('Menos de 01 ano');
    expect(result.masculino[idx]).toBe(-31);
    expect(result.feminino[idx]).toBe(26);
  });

  it('handles empty faixa_etaria without error', () => {
    const result = buildPyramidSeries([]);
    expect(result.categories).toHaveLength(0);
    expect(result.masculino).toHaveLength(0);
    expect(result.feminino).toHaveLength(0);
  });

  it('feminino values are positive', () => {
    const result = buildPyramidSeries(FAIXAS_ALVORADA);
    expect(result.feminino.every((v) => v >= 0)).toBe(true);
  });
});

// ── Unit tests: buildConditionsData ──────────────────────────────────────────

describe('buildConditionsData', () => {
  it('returns sorted array with hipertensão having highest count (313)', () => {
    const result = buildConditionsData(CONDICOES_ALVORADA, 3337);
    expect(result[0].key).toBe('hipertensao');
    expect(result[0].count).toBe(313);
    expect(result[0].label).toBe('Hipertensão');
  });

  it('returns empty array for empty condicoes', () => {
    const result = buildConditionsData({}, 0);
    expect(result).toHaveLength(0);
  });

  it('sorts by count descending', () => {
    const result = buildConditionsData(CONDICOES_ALVORADA, 3337);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].count).toBeGreaterThanOrEqual(result[i + 1].count);
    }
  });

  it('includes all priority conditions present in input', () => {
    const result = buildConditionsData(CONDICOES_ALVORADA, 3337);
    const keys = result.map((c) => c.key);
    expect(keys).toContain('hipertensao');
    expect(keys).toContain('diabetes');
    expect(keys).toContain('fumante');
    expect(keys).toContain('gestante');
  });

  it('excludes conditions with count 0', () => {
    const condicoes = { hipertensao: { sim: 0, nao: 100, nao_informado: 0 } };
    const result = buildConditionsData(condicoes, 100);
    expect(result).toHaveLength(0);
  });
});

// ── Render tests ──────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <PopulacaoPage />
    </MemoryRouter>,
  );
}

describe('PopulacaoPage', () => {
  beforeEach(() => {
    vi.mocked(useFilters).mockReturnValue({
      competencia: '2026-01',
      unidadeId: null,
      equipeId: null,
      painelPerfil: 'APS',
      competencias: [],
      setCompetencia: vi.fn(),
      setUnidadeId: vi.fn(),
      setEquipeId: vi.fn(),
      setPainelPerfil: vi.fn(),
    });
    vi.mocked(fetchPopulacaoCompetencias).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders loading skeleton while fetching', async () => {
    vi.mocked(fetchPopulacao).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId('populacao-page-shell')).toBeInTheDocument();
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('renders empty state with link to /importacao when data is null', async () => {
    vi.mocked(fetchPopulacao).mockResolvedValue(null);
    renderPage();
    const empty = await screen.findByTestId('populacao-empty');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent('Dados não disponíveis');
    const link = screen.getByRole('link', { name: /Ir para Importação/i });
    expect(link).toHaveAttribute('href', '/importacao');
  });

  it('renders summary card with cidadaos ativos count "3.337"', async () => {
    vi.mocked(fetchPopulacao).mockResolvedValue(MOCK_DATA);
    renderPage();
    const card = await screen.findByTestId('card-cidadaos-ativos');
    expect(card).toHaveTextContent('3.337');
  });

  it('renders per-unit table with "PSF JD Alvorada" row', async () => {
    vi.mocked(fetchPopulacao).mockResolvedValue(MOCK_DATA);
    renderPage();
    const table = await screen.findByTestId('populacao-units-table');
    expect(table).toHaveTextContent('PSF JD Alvorada');
  });

  it('renders conditions legend with "Hipertensão" label', async () => {
    vi.mocked(fetchPopulacao).mockResolvedValue(MOCK_DATA);
    renderPage();
    const section = await screen.findByTestId('populacao-conditions-section');
    expect(section).toHaveTextContent('Hipertensão');
  });

  it('renders pyramid chart section when faixa_etaria is non-empty', async () => {
    vi.mocked(fetchPopulacao).mockResolvedValue(MOCK_DATA);
    renderPage();
    const pyramid = await screen.findByTestId('populacao-pyramid-section');
    expect(pyramid).toBeInTheDocument();
  });

  it('navigate to /painel/populacao renders page without crash', () => {
    vi.mocked(fetchPopulacao).mockResolvedValue(null);
    expect(() => renderPage()).not.toThrow();
  });
});
