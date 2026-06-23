import { apiFetch } from './client';
import type { SiaSyncExistsResponse, SiaSyncRecord, SiaSyncResult } from '../types/sia';

function buildQuery(params?: Record<string, string | number>): string {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }
  return `?${new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString()}`;
}

export function sincronizarSiaProducao(
  competencia: string,
  options?: { reimportar?: boolean },
): Promise<SiaSyncResult> {
  return apiFetch<SiaSyncResult>('/api/sia/sincronizar', {
    method: 'POST',
    body: JSON.stringify({
      competencia,
      reimportar: options?.reimportar === true,
    }),
  });
}

export function fetchSiaSincronizacoes(): Promise<SiaSyncRecord[]> {
  return apiFetch<SiaSyncRecord[]>('/api/sia/sincronizacoes');
}

export async function fetchUltimaSiaSync(): Promise<SiaSyncRecord | null> {
  const list = await fetchSiaSincronizacoes();
  return list.length ? list[0] : null;
}

export function fetchSiaSincronizacaoExiste(
  competencia: string,
): Promise<SiaSyncExistsResponse> {
  return apiFetch<SiaSyncExistsResponse>(`/api/sia/sincronizacoes/existe${buildQuery({ competencia })}`);
}
