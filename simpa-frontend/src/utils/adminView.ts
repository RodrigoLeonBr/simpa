import type { CadastroColumnDef, CadastroFieldDef } from '../config/cadastroEntities';
import { ADMIN_PERFIS } from '../types/admin';

export function canAccessAdminModule(perfil: string | undefined): boolean {
  return perfil === 'Administrador' || perfil === 'Planejamento';
}

export function canManageAdminUsers(perfil: string | undefined): boolean {
  return perfil === 'Administrador';
}

export function canReadAuditLog(perfil: string | undefined): boolean {
  return perfil === 'Administrador' || perfil === 'Planejamento';
}

export function canEditCadastrosEstabelecimento(perfil: string | undefined): boolean {
  return (
    perfil === 'Administrador' ||
    perfil === 'Gestor Secretaria' ||
    perfil === 'Planejamento'
  );
}

export const USUARIO_COLUMNS: CadastroColumnDef[] = [
  { key: 'username', label: 'Usuário', mono: true },
  { key: 'nome', label: 'Nome' },
  { key: 'perfil', label: 'Perfil' },
  { key: 'ativo', label: 'Ativo' },
  { key: 'ultimo_login', label: 'Último login', mono: true },
];

export const USUARIO_CREATE_FIELDS: CadastroFieldDef[] = [
  { key: 'username', label: 'Usuário', required: true, mono: true },
  { key: 'senha', label: 'Senha', required: true },
  { key: 'nome', label: 'Nome completo', required: true },
  { key: 'perfil', label: 'Perfil', required: true, type: 'select' },
];

export const USUARIO_EDIT_FIELDS: CadastroFieldDef[] = [
  { key: 'nome', label: 'Nome completo', required: true },
  { key: 'perfil', label: 'Perfil', required: true, type: 'select' },
  { key: 'ativo', label: 'Ativo (sim/não)', required: true },
  { key: 'senha', label: 'Nova senha (opcional)' },
];

export function perfilSelectOptions() {
  return ADMIN_PERFIS.map((perfil) => ({ value: perfil, label: perfil }));
}

export function formatAdminDate(value: unknown): string {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR');
}

export function formatAdminBoolean(value: unknown): string {
  if (value === true || value === 'true' || value === 'sim') return 'Sim';
  if (value === false || value === 'false' || value === 'não' || value === 'nao') return 'Não';
  return '—';
}

export function usuarioRowForTable(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    ativo: formatAdminBoolean(row.ativo),
    ultimo_login: formatAdminDate(row.ultimo_login),
  };
}
