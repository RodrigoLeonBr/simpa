import { apiFetch } from './client';
import type { ContratoDashboard } from '../types/contrato';

export function fetchDashboard(
  competencia: string,
  unidade?: string,
  equipe?: string,
): Promise<ContratoDashboard> {
  const params = new URLSearchParams({ competencia });
  if (unidade) params.set('unidade', unidade);
  if (equipe) params.set('equipe', equipe);
  return apiFetch<ContratoDashboard>(`/api/v1/dashboard/planejamento?${params}`);
}
