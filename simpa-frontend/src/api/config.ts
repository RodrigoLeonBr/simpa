import { apiFetch } from './client';

export function fetchCompetenciaPadrao(): Promise<string> {
  return apiFetch<{ competencia: string }>('/api/config/competencia-padrao').then(
    (payload) => payload.competencia,
  );
}
