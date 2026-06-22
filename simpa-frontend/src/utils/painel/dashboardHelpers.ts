import type { ContratoDashboard, HistoricoMensal } from '../../types/contrato';

export function historicoSorted(data: ContratoDashboard): HistoricoMensal[] {
  const historico = data.modulos?.atencao_primaria_esus?.historico_mensal;
  if (!historico?.length) return [];
  return [...historico].sort((a, b) => a.competencia.localeCompare(b.competencia));
}

export function sparkFromHistorico(historico: HistoricoMensal[], field: keyof HistoricoMensal): number[] {
  return historico.map((item) => {
    const value = item[field];
    return typeof value === 'number' ? value : 0;
  });
}

interface FinanciamentoIndicadorLike {
  valor: number | null;
  meta: number | null;
}

function resolveFinanciamentoIndicadores(data: ContratoDashboard): FinanciamentoIndicadorLike[] {
  const fin = data.modulos?.financiamento_metas as
    | {
        indicadores?: FinanciamentoIndicadorLike[];
        componente_qualidade_aps?: { indicadores?: FinanciamentoIndicadorLike[] } | FinanciamentoIndicadorLike[];
        igm_sus_paulista?: { indicadores?: FinanciamentoIndicadorLike[] } | FinanciamentoIndicadorLike[];
      }
    | undefined;

  if (!fin) return [];

  if (Array.isArray(fin.indicadores)) {
    return fin.indicadores;
  }

  const items: FinanciamentoIndicadorLike[] = [];

  if (fin.componente_qualidade_aps && !Array.isArray(fin.componente_qualidade_aps)) {
    const apsItems = fin.componente_qualidade_aps.indicadores;
    if (Array.isArray(apsItems)) items.push(...apsItems);
  }

  if (fin.igm_sus_paulista && !Array.isArray(fin.igm_sus_paulista)) {
    const igmItems = fin.igm_sus_paulista.indicadores;
    if (Array.isArray(igmItems)) items.push(...igmItems);
  }

  return items;
}

export function countMetasAtingidas(data: ContratoDashboard): number | null {
  const items = resolveFinanciamentoIndicadores(data);
  const valid = items.filter((item) => item.valor !== null && item.meta !== null);
  if (valid.length === 0) return null;
  return valid.filter((item) => (item.valor ?? 0) >= (item.meta ?? 0)).length;
}

export function countMetasTotal(data: ContratoDashboard): number | null {
  const items = resolveFinanciamentoIndicadores(data);
  const valid = items.filter((item) => item.meta !== null || item.valor !== null);
  if (valid.length === 0) return null;
  return valid.length;
}
