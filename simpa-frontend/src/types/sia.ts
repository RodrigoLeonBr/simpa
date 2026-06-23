export interface SiaSyncRecord {
  id: number;
  competencia: string;
  status: 'ok' | 'parcial' | 'erro' | string;
  registros: number;
  erros?: number;
  sincronizado_em?: string | null;
}

export interface SiaSyncExistsResponse {
  competencia: string;
  exists: boolean;
  status: 'ok' | 'parcial' | 'erro' | null;
  registros: number;
  sincronizado_em?: string | null;
}

export interface SiaSyncResult {
  sincronizacao_id?: number;
  competencia: string;
  registros: number;
  erros: number;
  status: 'ok' | 'parcial' | 'erro';
  error?: string;
  orphan_cnes?: number;
  estabelecimentos_resolvidos?: number;
  linhas_mysql_raw?: number;
  consolidacao?: {
    ok?: boolean;
    status?: string;
    error?: string;
  } | null;
}
