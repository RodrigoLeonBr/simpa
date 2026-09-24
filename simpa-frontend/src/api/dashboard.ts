import { apiFetch } from './client';
import type { ContratoDashboard } from '../types/contrato';

export interface DashboardFetchFilters {
  estabelecimentoId?: number;
  equipeId?: number;
}

export function fetchDashboard(
  competencia: string,
  filters?: DashboardFetchFilters,
  periodo?: string,
): Promise<ContratoDashboard> {
  const params = new URLSearchParams({ competencia });
  // periodo (trimestre/quadri/ano) faz o backend somar os meses do intervalo.
  if (periodo && periodo !== competencia) {
    params.set('periodo', periodo);
  }
  if (filters?.estabelecimentoId != null) {
    params.set('estabelecimento_id', String(filters.estabelecimentoId));
  }
  if (filters?.equipeId != null) {
    params.set('equipe_id', String(filters.equipeId));
  }
  return apiFetch<ContratoDashboard>(`/api/v1/dashboard/planejamento?${params}`);
}
