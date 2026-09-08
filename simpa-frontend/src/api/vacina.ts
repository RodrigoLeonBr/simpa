import { apiFetch } from './client';
import type {
  VacinaImportPreview,
  CoberturaRow,
  VacinaGrupo,
  FaixaGrupo,
  PopulacaoAlvo,
  Esquema,
  Imunobiologico,
} from '../types/vacina';

export type {
  VacinaImportPreview,
  CoberturaRow,
  VacinaGrupo,
  FaixaGrupo,
  PopulacaoAlvo,
  Esquema,
  Imunobiologico,
};

export function previewVacina(file: File): Promise<VacinaImportPreview> {
  const fd = new FormData();
  fd.append('arquivo', file);
  return apiFetch<VacinaImportPreview>('/api/vacina/importacao/preview', {
    method: 'POST',
    body: fd,
  });
}

export function importVacina(
  file: File,
  competencia?: string,
): Promise<{ carga_id: number; competencia: string; doses_total: number; linhas: number }> {
  const fd = new FormData();
  fd.append('arquivo', file);
  if (competencia) fd.append('competencia', competencia);
  return apiFetch('/api/vacina/importacao', { method: 'POST', body: fd });
}

export function fetchCobertura(params: {
  ano: number;
  competencia?: string;
  grupo_id?: number;
  imuno_codigo?: string;
}): Promise<CoberturaRow[]> {
  const p = new URLSearchParams({ ano: String(params.ano) });
  if (params.competencia != null) p.set('competencia', params.competencia);
  if (params.grupo_id != null) p.set('grupo_id', String(params.grupo_id));
  if (params.imuno_codigo != null) p.set('imuno_codigo', params.imuno_codigo);
  return apiFetch<CoberturaRow[]>(`/api/vacina/cobertura?${p}`);
}

export function fetchGrupos(): Promise<VacinaGrupo[]> {
  return apiFetch<VacinaGrupo[]>('/api/vacina/grupos');
}

export function createGrupo(b: {
  nome: string;
  slug: string;
  ordem?: number;
}): Promise<VacinaGrupo> {
  return apiFetch<VacinaGrupo>('/api/vacina/grupos', {
    method: 'POST',
    body: JSON.stringify(b),
  });
}

export function updateGrupo(id: number, b: Partial<VacinaGrupo>): Promise<VacinaGrupo> {
  return apiFetch<VacinaGrupo>(`/api/vacina/grupos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(b),
  });
}

export function fetchFaixaGrupo(): Promise<FaixaGrupo[]> {
  return apiFetch<FaixaGrupo[]>('/api/vacina/faixa-grupo');
}

export function setFaixaGrupo(faixa: string, grupo_id: number | null): Promise<FaixaGrupo> {
  return apiFetch<FaixaGrupo>(`/api/vacina/faixa-grupo/${encodeURIComponent(faixa)}`, {
    method: 'PUT',
    body: JSON.stringify({ grupo_id }),
  });
}

export function fetchPopulacao(ano?: number): Promise<PopulacaoAlvo[]> {
  const p = ano != null ? `?ano=${ano}` : '';
  return apiFetch<PopulacaoAlvo[]>(`/api/vacina/populacao${p}`);
}

export function upsertPopulacao(b: {
  ano: number;
  grupo_id: number;
  populacao: number;
}): Promise<PopulacaoAlvo> {
  return apiFetch<PopulacaoAlvo>('/api/vacina/populacao', {
    method: 'POST',
    body: JSON.stringify(b),
  });
}

export function fetchEsquema(): Promise<Esquema[]> {
  return apiFetch<Esquema[]>('/api/vacina/esquema');
}

export function upsertEsquema(b: {
  imuno_codigo: string;
  grupo_id: number;
  num_doses: number;
}): Promise<Esquema> {
  return apiFetch<Esquema>('/api/vacina/esquema', {
    method: 'POST',
    body: JSON.stringify(b),
  });
}

export function deleteEsquema(id: number): Promise<{ id: number }> {
  return apiFetch<{ id: number }>(`/api/vacina/esquema/${id}`, { method: 'DELETE' });
}

export function fetchImunobiologicos(): Promise<Imunobiologico[]> {
  return apiFetch<Imunobiologico[]>('/api/vacina/imunobiologicos');
}
