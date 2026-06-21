export interface AdminUsuario {
  id: number;
  username: string;
  nome: string;
  perfil: string;
  ativo: boolean;
  criado_em?: string;
  ultimo_login?: string | null;
}

export interface AuditLogEntry {
  id: number;
  usuario_id: number | null;
  username: string | null;
  acao: string;
  recurso: string | null;
  detalhes: Record<string, unknown> | null;
  ip: string | null;
  criado_em: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface Configuracao {
  chave: string;
  valor: string;
  descricao?: string | null;
  atualizado_em?: string;
}

export interface DbBackupMeta {
  filename: string;
  size: number;
  created_at: string;
}

export const ADMIN_PERFIS = [
  'Administrador',
  'Gestor Secretaria',
  'Gestor de Unidade',
  'Planejamento',
] as const;

export const COMPETENCIA_PADRAO_CHAVE = 'competencia_ativa_padrao';
