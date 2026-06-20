import type { CargaEsus } from '../types/contrato';
import type { PreviewCargaItem } from '../utils/importacaoView';
import { apiFetch } from './client';

export interface UploadCargaResult {
  carga_id?: number;
  status?: string;
  arquivo?: string;
}

export interface CargaFiltros {
  competencia?: string;
  unidade?: string;
}

function buildFormData(files: File[], fieldName = 'files'): FormData {
  const form = new FormData();
  files.forEach((file) => form.append(fieldName, file));
  return form;
}

export function fetchCargas(filtros?: CargaFiltros): Promise<CargaEsus[]> {
  const params = new URLSearchParams();
  if (filtros?.competencia) params.set('competencia', filtros.competencia);
  if (filtros?.unidade) params.set('unidade', filtros.unidade);
  const query = params.toString();
  return apiFetch<CargaEsus[]>(`/api/importacao/cargas${query ? `?${query}` : ''}`);
}

export function previewUpload(files: File[]): Promise<PreviewCargaItem[]> {
  return apiFetch<PreviewCargaItem[]>('/api/importacao/preview', {
    method: 'POST',
    body: buildFormData(files),
  });
}

export function uploadCargas(files: File[]): Promise<UploadCargaResult[]> {
  return apiFetch<UploadCargaResult[]>('/api/importacao/upload', {
    method: 'POST',
    body: buildFormData(files),
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
