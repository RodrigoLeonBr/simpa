// Types for the SIHD (hospitalar) import module.

export interface SihSincronizacao {
  id: number;
  competencia: string;
  status: 'ok' | 'parcial' | 'erro' | 'pendente';
  qtd_internacoes: number;
  qtd_procedimentos: number;
  orphan_cnes: number;
  erros: number;
  sincronizado_em: string;
}

export interface SihImportResult {
  sincronizacao_id?: number;
  competencia: string;
  status: 'ok' | 'parcial' | 'erro';
  qtd_internacoes: number;
  qtd_procedimentos: number;
  orphan_cnes: number;
  erros: number;
  linhas_mysql_raw?: number;
  error?: string;
  consolidacao?: {
    ok?: boolean;
    status?: string;
    error?: string;
  } | null;
}

export interface SihConflictErrorBody {
  code: 'SIH_COMPETENCIA_JA_IMPORTADA';
  competencia: string;
  sincronizado_em?: string;
  qtd_internacoes: number;
  qtd_procedimentos: number;
}

export interface SihSyncExistsResponse {
  competencia: string;
  exists: boolean;
  status: 'ok' | 'parcial' | 'erro' | null;
  qtd_internacoes: number;
  qtd_procedimentos: number;
  sincronizado_em?: string | null;
}

export interface SihSyncProgressEvent {
  at: string;
  stage: string;
  event: string;
  message?: string | null;
  block_index?: number | null;
  block_rows?: number | null;
  duration_ms?: number | null;
  inserted_rows_total?: number | null;
  rows_processed?: number | null;
  chunk_index?: number | null;
  chunks_total?: number | null;
  table?: string | null;
}

export interface SihProgress {
  executionId: string;
  competencia: string;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'running' | 'done' | 'erro' | string;
  stage: string;
  summary?: {
    status: string;
    qtd_internacoes: number;
    qtd_procedimentos: number;
    orphan_cnes: number;
    erros: number;
    linhas_mysql_raw: number;
  } | null;
  error?: string | null;
  events: SihSyncProgressEvent[];
}

export interface SihInternacao {
  id: number;
  competencia: string;
  cnes: string;
  estabelecimento_id?: number | null;
  proc_principal?: string | null;
  diag_principal?: string | null;
  complexidade?: string | null;
  financiamento?: string | null;
  motivo_saida?: string | null;
  sexo?: string | null;
  qtd_aih: number;
  total_diarias: number;
  total_diarias_uti: number;
  total_valor: number;
  media_idade?: number | null;
  media_diarias?: number | null;
  descricao_financiamento?: string | null;
}

export interface SihProcedimento {
  id: number;
  competencia: string;
  cnes: string;
  estabelecimento_id?: number | null;
  proc_detalhado?: string | null;
  cbo_profissional?: string | null;
  financiamento_detalhe?: string | null;
  qtd_aih_distintas: number;
  total_quantidade: number;
  total_valor_item: number;
  descricao_cbo?: string | null;
}
