import { apiFetch } from './client';
import type {
  SihImportResult,
  SihInternacao,
  SihProcedimento,
  SihProgress,
  SihSincronizacao,
  SihSyncExistsResponse,
} from '../types/sih';

// ---------------------------------------------------------------------------
// SihConflictError — thrown when POST /sincronizar returns 409
// ---------------------------------------------------------------------------

export class SihConflictError extends Error {
  readonly code = 'SIH_COMPETENCIA_JA_IMPORTADA' as const;
  competencia: string;
  sincronizado_em?: string;
  qtd_aih: number;
  qtd_internacoes: number;
  qtd_procedimentos: number;

  constructor(data: {
    competencia: string;
    sincronizado_em?: string;
    qtd_aih?: number;
    qtd_internacoes?: number;
    qtd_procedimentos?: number;
  }) {
    super('SIH_COMPETENCIA_JA_IMPORTADA');
    this.name = 'SihConflictError';
    this.competencia = data.competencia;
    this.sincronizado_em = data.sincronizado_em;
    this.qtd_aih = data.qtd_aih ?? 0;
    this.qtd_internacoes = data.qtd_internacoes ?? 0;
    this.qtd_procedimentos = data.qtd_procedimentos ?? 0;
  }
}

/**
 * Type guard: returns true when error is a SihConflictError or has code 'SIH_COMPETENCIA_JA_IMPORTADA'.
 * Handles both class instances and raw error objects from serialized responses.
 */
export function isSihConflictError(error: unknown): error is SihConflictError {
  if (error instanceof SihConflictError) return true;
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as Record<string, unknown>)['code'] === 'SIH_COMPETENCIA_JA_IMPORTADA'
  );
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  ) as [string, string | number][];
  if (!entries.length) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/**
 * POST /api/sih/sincronizar
 * Throws SihConflictError when the competência is already imported (409).
 */
export async function sincronizarSih(
  competencia: string,
  options?: { reimportar?: boolean; executionId?: string },
): Promise<SihImportResult> {
  const { reimportar, executionId } = options ?? {};
  try {
    return await apiFetch<SihImportResult>('/api/sih/sincronizar', {
      method: 'POST',
      body: JSON.stringify({ competencia, reimportar, executionId }),
    });
  } catch (err) {
    // apiFetch loses the 409 body; re-throw as SihConflictError so isSihConflictError works.
    if (err instanceof Error && err.message === 'HTTP 409') {
      throw new SihConflictError({ competencia });
    }
    throw err;
  }
}

/** GET /api/sih/sincronizacoes */
export function getSihSincronizacoes(): Promise<SihSincronizacao[]> {
  return apiFetch<SihSincronizacao[]>('/api/sih/sincronizacoes');
}

/** GET /api/sih/sincronizacoes/existe?competencia=YYYY-MM */
export function getSihSincronizacaoExiste(
  competencia: string,
): Promise<SihSyncExistsResponse> {
  return apiFetch<SihSyncExistsResponse>(
    `/api/sih/sincronizacoes/existe${buildQuery({ competencia })}`,
  );
}

/** GET /api/sih/sincronizar/progresso/:executionId */
export function getSihSyncProgress(executionId: string): Promise<SihProgress> {
  return apiFetch<SihProgress>(
    `/api/sih/sincronizar/progresso/${encodeURIComponent(executionId)}`,
  );
}

/** GET /api/sih/internacoes */
export function getSihInternacoes(
  params?: Record<string, string | number | undefined>,
): Promise<SihInternacao[]> {
  return apiFetch<SihInternacao[]>(`/api/sih/internacoes${buildQuery(params ?? {})}`);
}

/** GET /api/sih/procedimentos */
export function getSihProcedimentos(
  params?: Record<string, string | number | undefined>,
): Promise<SihProcedimento[]> {
  return apiFetch<SihProcedimento[]>(`/api/sih/procedimentos${buildQuery(params ?? {})}`);
}
