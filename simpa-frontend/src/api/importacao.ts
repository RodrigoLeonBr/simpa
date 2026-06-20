import type {
  CargaEsusComCadastro,
  EsusImportMapeamento,
  MapeamentoInput,
  MapeamentosListResponse,
  MapeamentosQuery,
  PreviewCargaEnriquecida,
  ResolucaoUpload,
  UploadCargaResult,
} from '../types/importacao';
import { apiFetch } from './client';

export type {
  CargaEsusComCadastro,
  EsusImportMapeamento,
  MapeamentoInput,
  MapeamentosListResponse,
  MapeamentosQuery,
  PreviewCargaEnriquecida,
  ResolucaoUpload,
  UploadCargaResult,
} from '../types/importacao';

export interface CargaFiltros {
  competencia?: string;
  unidade?: string;
}

export function buildUploadFormData(files: File[], resolucoes: ResolucaoUpload[]): FormData {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  form.append('resolucoes', JSON.stringify(resolucoes));
  return form;
}

function buildFormData(files: File[], fieldName = 'files'): FormData {
  const form = new FormData();
  files.forEach((file) => form.append(fieldName, file));
  return form;
}

export function fetchCargas(filtros?: CargaFiltros): Promise<CargaEsusComCadastro[]> {
  const params = new URLSearchParams();
  if (filtros?.competencia) params.set('competencia', filtros.competencia);
  if (filtros?.unidade) params.set('unidade', filtros.unidade);
  const query = params.toString();
  return apiFetch<CargaEsusComCadastro[]>(`/api/importacao/cargas${query ? `?${query}` : ''}`);
}

export function previewUpload(files: File[]): Promise<PreviewCargaEnriquecida[]> {
  return apiFetch<PreviewCargaEnriquecida[]>('/api/importacao/preview', {
    method: 'POST',
    body: buildFormData(files),
  });
}

export function uploadCargas(
  files: File[],
  resolucoes: ResolucaoUpload[],
): Promise<UploadCargaResult[]> {
  return apiFetch<UploadCargaResult[]>('/api/importacao/upload', {
    method: 'POST',
    body: buildUploadFormData(files, resolucoes),
  });
}

export function fetchMapeamentos(query?: MapeamentosQuery): Promise<MapeamentosListResponse> {
  const params = new URLSearchParams();
  if (query?.q) params.set('q', query.q);
  if (query?.page != null) params.set('page', String(query.page));
  if (query?.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  return apiFetch<MapeamentosListResponse>(
    `/api/importacao/mapeamentos${qs ? `?${qs}` : ''}`,
  );
}

export function createMapeamento(body: MapeamentoInput): Promise<EsusImportMapeamento> {
  return apiFetch<EsusImportMapeamento>('/api/importacao/mapeamentos', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateMapeamento(
  id: number,
  body: Partial<MapeamentoInput>,
): Promise<EsusImportMapeamento> {
  return apiFetch<EsusImportMapeamento>(`/api/importacao/mapeamentos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteMapeamento(id: number): Promise<{ inativado: boolean; id: number }> {
  return apiFetch<{ inativado: boolean; id: number }>(`/api/importacao/mapeamentos/${id}`, {
    method: 'DELETE',
  });
}

export function reprocessarCarga(id: number): Promise<UploadCargaResult> {
  return apiFetch<UploadCargaResult>(`/api/importacao/${id}/reprocessar`, {
    method: 'POST',
  });
}

export function substituirCarga(id: number, file: File): Promise<UploadCargaResult> {
  return apiFetch<UploadCargaResult>(`/api/importacao/${id}/substituir`, {
    method: 'PUT',
    body: buildFormData([file], 'file'),
  });
}

export function excluirCarga(id: number): Promise<{ deleted: boolean; id: number }> {
  return apiFetch<{ deleted: boolean; id: number }>(`/api/importacao/${id}`, {
    method: 'DELETE',
  });
}
