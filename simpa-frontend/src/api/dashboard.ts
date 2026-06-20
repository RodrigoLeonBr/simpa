import { apiFetch } from './client';
import type { ContratoDashboard } from '../types/contrato';

export interface DashboardFetchFilters {
  estabelecimentoId?: number;
  equipeId?: number;
}

export function fetchDashboard(
  competencia: string,
  filters?: DashboardFetchFilters,
): Promise<ContratoDashboard> {
  const params = new URLSearchParams({ competencia });
  if (filters?.estabelecimentoId != null) {
    params.set('estabelecimento_id', String(filters.estabelecimentoId));
  }
  if (filters?.equipeId != null) {
    params.set('equipe_id', String(filters.equipeId));
  }
  return apiFetch<ContratoDashboard>(`/api/v1/dashboard/planejamento?${params}`);
}
