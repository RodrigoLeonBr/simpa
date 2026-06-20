import type {
  AdminUsuario,
  AuditLogResponse,
  Configuracao,
} from '../types/admin';
import { apiFetch } from './client';

export function fetchUsuarios(): Promise<AdminUsuario[]> {
  return apiFetch<AdminUsuario[]>('/api/admin/usuarios');
}

export function createUsuario(payload: {
  username: string;
  senha: string;
  nome: string;
  perfil: string;
}): Promise<AdminUsuario> {
  return apiFetch<AdminUsuario>('/api/admin/usuarios', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUsuario(
  id: number,
  payload: Partial<{ nome: string; perfil: string; ativo: boolean; senha: string }>,
): Promise<AdminUsuario> {
  return apiFetch<AdminUsuario>(`/api/admin/usuarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function inactivateUsuario(id: number): Promise<{ inativado: boolean; id: number }> {
  return apiFetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' });
}

export function fetchAuditLog(params?: {
  page?: number;
  limit?: number;
  usuario_id?: number;
  acao?: string;
}): Promise<AuditLogResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.usuario_id) query.set('usuario_id', String(params.usuario_id));
  if (params?.acao) query.set('acao', params.acao);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch<AuditLogResponse>(`/api/admin/audit-log${suffix}`);
}

export function fetchConfiguracoes(): Promise<Configuracao[]> {
  return apiFetch<Configuracao[]>('/api/admin/configuracoes');
}

export function updateConfiguracoes(
  configuracoes: Array<{ chave: string; valor: string; descricao?: string }>,
): Promise<Configuracao[]> {
  return apiFetch<Configuracao[]>('/api/admin/configuracoes', {
    method: 'PUT',
    body: JSON.stringify({ configuracoes }),
  });
}
