import type { ContratoDashboard } from '../../types/contrato';
import { historicoSorted } from './dashboardHelpers';
import type { TrendPoint } from './types';

export function buildTrendSeries(data: ContratoDashboard): TrendPoint[] {
  return historicoSorted(data).map((item) => ({
    competencia: item.competencia,
    atendimentos: item.atendimentos,
    meta: item.meta,
  }));
}
