import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPopulacao, fetchPopulacaoCompetencias } from './populacao';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './client';

const mockResponse = {
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
  faixa_etaria: [{ faixa: 'Menos de 01 ano', masculino: 31, feminino: 26 }],
  condicoes_saude: { gestante: { sim: 24, nao: 284, nao_informado: 3029 } },
  raca_cor: { branca: 2570 },
};

describe('fetchPopulacao', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiFetch with correct URL for competencia only', async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockResponse);
    await fetchPopulacao('2026-01');
    expect(apiFetch).toHaveBeenCalledWith('/api/populacao?competencia=2026-01');
  });

  it('calls apiFetch with estabelecimento_id when provided', async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockResponse);
    await fetchPopulacao('2026-01', 5);
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/populacao?competencia=2026-01&estabelecimento_id=5',
    );
  });

  it('returns null when apiFetch throws HTTP 404 error', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('HTTP 404'));
    const result = await fetchPopulacao('2026-01');
    expect(result).toBeNull();
  });

  it('returns null when apiFetch throws "Sem dados" backend error', async () => {
    vi.mocked(apiFetch).mockRejectedValue(
      new Error('Sem dados para a competência/unidade selecionada'),
    );
    const result = await fetchPopulacao('2026-01');
    expect(result).toBeNull();
  });

  it('re-throws when apiFetch throws non-404 error', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('Internal Server Error'));
    await expect(fetchPopulacao('2026-01')).rejects.toThrow('Internal Server Error');
  });

  it('re-throws on network error (non-Error object)', async () => {
    vi.mocked(apiFetch).mockRejectedValue('network failure');
    await expect(fetchPopulacao('2026-01')).rejects.toBe('network failure');
  });

  it('returns PopulacaoResponse on success', async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockResponse);
    const result = await fetchPopulacao('2026-01');
    expect(result).toBe(mockResponse);
    expect(result?.total_cidadaos_ativos).toBe(3337);
  });

  it('does not append estabelecimento_id when undefined', async () => {
    vi.mocked(apiFetch).mockResolvedValue(mockResponse);
    await fetchPopulacao('2026-01', undefined);
    expect(apiFetch).toHaveBeenCalledWith('/api/populacao?competencia=2026-01');
  });
});

describe('fetchPopulacaoCompetencias', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls apiFetch with competencias endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    await fetchPopulacaoCompetencias();
    expect(apiFetch).toHaveBeenCalledWith('/api/populacao/competencias');
  });

  it('returns competencia entries array', async () => {
    const entries = [
      { competencia: '2026-01', unidades_count: 3, total_cidadaos_ativos: 10173 },
    ];
    vi.mocked(apiFetch).mockResolvedValue(entries);
    const result = await fetchPopulacaoCompetencias();
    expect(result).toHaveLength(1);
    expect(result[0].competencia).toBe('2026-01');
    expect(result[0].total_cidadaos_ativos).toBe(10173);
  });

  it('returns empty array when no competencias', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    const result = await fetchPopulacaoCompetencias();
    expect(result).toEqual([]);
  });
});
