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

export interface SiaSyncProgressEvent {
  at: string;
  stage: string;
  event: string;
  message?: string | null;
  block_index?: number | null;
  block_rows?: number | null;
  offset?: number | null;
  duration_ms?: number | null;
  extracted_rows_total?: number | null;
  transformed_rows_total?: number | null;
  inserted_rows_total?: number | null;
  total_rows?: number | null;
  chunks_total?: number | null;
  chunk_index?: number | null;
  rows_processed?: number | null;
}

export interface SiaSyncProgress {
  executionId: string;
  competencia: string;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'running' | 'done' | 'erro' | string;
  stage: string;
  summary?: {
    status: string;
    registros: number;
    erros: number;
    linhas_mysql_raw: number;
  } | null;
  error?: string | null;
  events: SiaSyncProgressEvent[];
}
