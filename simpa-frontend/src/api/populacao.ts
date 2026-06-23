import { apiFetch } from './client';
import type { CompetenciaEntry, PopulacaoResponse } from '../types/populacao';

export type { PopulacaoResponse, CompetenciaEntry, FaixaEtaria, CondicaoSaude, CondicoesSaude, RacaCor, UnidadePopulacao } from '../types/populacao';

export async function fetchPopulacao(
  competencia: string,
  estabelecimentoId?: number,
): Promise<PopulacaoResponse | null> {
  const params = new URLSearchParams({ competencia });
  if (estabelecimentoId != null) {
    params.set('estabelecimento_id', String(estabelecimentoId));
  }
  try {
    return await apiFetch<PopulacaoResponse>(`/api/populacao?${params}`);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === 'HTTP 404' || err.message.startsWith('Sem dados')) {
        return null;
      }
    }
    throw err;
  }
}

export function fetchPopulacaoCompetencias(): Promise<CompetenciaEntry[]> {
  return apiFetch<CompetenciaEntry[]>('/api/populacao/competencias');
}
