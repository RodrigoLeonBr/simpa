import type { CadastroEntityKey } from '../config/cadastroEntities';
import type {
  CadastroRecord,
  CbosListResponse,
  CadastroSyncRecord,
  CadastroSyncResult,
  EnrichmentBySlug,
  EnrichmentSlug,
  Equipe,
  Estabelecimento,
  EstabelecimentoEnriquecimento,
  EstabelecimentoPerfil,
  EstabelecimentosListResponse,
  FormasListResponse,
  LeitosVigencia,
  LeitosVigenciaInput,
  ProcedimentosListResponse,
} from '../types/cadastros';
import { apiFetch } from './client';
import { ESTABELECIMENTOS_APS_QUERY } from '../utils/estabelecimentosView';

export type { CadastroRecord, Emenda, Equipe } from '../types/cadastros';

function cadastroPath(key: CadastroEntityKey): string {
  return `/api/cadastros/${key}`;
}

export function fetchCadastroList<T extends CadastroRecord>(
  key: CadastroEntityKey,
  query?: Record<string, string | number>,
): Promise<T[]> {
  const params = query
    ? `?${new URLSearchParams(
        Object.entries(query).map(([k, v]) => [k, String(v)]),
      ).toString()}`
    : '';
  return apiFetch<T[]>(`${cadastroPath(key)}${params}`);
}

export function createCadastro<T extends CadastroRecord>(
  key: CadastroEntityKey,
  body: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(cadastroPath(key), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateCadastro<T extends CadastroRecord>(
  key: CadastroEntityKey,
  id: number,
  body: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`${cadastroPath(key)}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function inactivateCadastro(
  key: CadastroEntityKey,
  id: number,
): Promise<{ inativado: true; id: number }> {
  return apiFetch<{ inativado: true; id: number }>(`${cadastroPath(key)}/${id}`, {
    method: 'DELETE',
  });
}

export function fetchEquipes(estabelecimentoId?: number): Promise<Equipe[]> {
  return fetchCadastroList<Equipe>(
    'equipes',
    estabelecimentoId ? { estabelecimento_id: estabelecimentoId } : undefined,
  );
}

export async function fetchEstabelecimentosAps(): Promise<Estabelecimento[]> {
  const result = await fetchEstabelecimentos(ESTABELECIMENTOS_APS_QUERY);
  return result.data;
}

export function sincronizarCadastros(): Promise<CadastroSyncResult> {
  return apiFetch<CadastroSyncResult>('/api/cadastros/sincronizar', {
    method: 'POST',
  });
}

export function fetchUltimaCadastroSync(): Promise<CadastroSyncRecord> {
  return apiFetch<CadastroSyncRecord>('/api/cadastros/sincronizacoes/ultima');
}

function buildQuery(params?: Record<string, string | number>): string {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }
  return `?${new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)]),
  ).toString()}`;
}

export function fetchEstabelecimentos(
  query?: Record<string, string | number>,
): Promise<EstabelecimentosListResponse> {
  return apiFetch<EstabelecimentosListResponse>(
    `/api/cadastros/estabelecimentos${buildQuery(query)}`,
  );
}

export function fetchEstabelecimentoById(id: number): Promise<Estabelecimento> {
  return apiFetch<Estabelecimento>(`/api/cadastros/estabelecimentos/${id}`);
}

export function updatePerfil(
  id: number,
  perfil: EstabelecimentoPerfil,
): Promise<Estabelecimento> {
  return apiFetch<Estabelecimento>(`/api/cadastros/estabelecimentos/${id}/perfil`, {
    method: 'PUT',
    body: JSON.stringify({ perfil }),
  });
}

export function updateIdentidade(
  id: number,
  body: { nome?: string; status?: string },
): Promise<Estabelecimento> {
  return apiFetch<Estabelecimento>(`/api/cadastros/estabelecimentos/${id}/identidade`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function updateEnrichmentBySlug<S extends EnrichmentSlug>(
  id: number,
  slug: S,
  body: Partial<EnrichmentBySlug[S]>,
): Promise<Estabelecimento> {
  return apiFetch<Estabelecimento>(
    `/api/cadastros/estabelecimentos/${id}/enriquecimento/${slug}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );
}

export function updateEnriquecimento(
  id: number,
  body: EstabelecimentoEnriquecimento,
): Promise<Estabelecimento> {
  return apiFetch<Estabelecimento>(`/api/cadastros/estabelecimentos/${id}/enriquecimento`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function fetchProcedimentos(
  query?: Record<string, string | number>,
): Promise<ProcedimentosListResponse> {
  return apiFetch<ProcedimentosListResponse>(
    `/api/cadastros/procedimentos${buildQuery(query)}`,
  );
}

export function fetchFormas(
  query?: Record<string, string | number>,
): Promise<FormasListResponse> {
  return apiFetch<FormasListResponse>(
    `/api/cadastros/formas${buildQuery(query)}`,
  );
}

export function fetchCbos(
  query?: Record<string, string | number>,
): Promise<CbosListResponse> {
  return apiFetch<CbosListResponse>(
    `/api/cadastros/cbos${buildQuery(query)}`,
  );
}

export interface MetaOciPar {
  id: number;
  competencia: string;
  tipo_oci: string;
  estabelecimento_id: number | null;
  estabelecimento_nome?: string | null;
  meta_quantidade: number;
  meta_valor: number | null;
  codigo_sigtap_prefix: string | null;
  periodicidade: 'mensal' | 'quadrimestral' | 'anual';
  origem: string;
  status: string;
}

export function fetchMetasOciPar(query?: Record<string, string>): Promise<MetaOciPar[]> {
  return apiFetch<MetaOciPar[]>(`/api/cadastros/metas-oci-par${buildQuery(query)}`);
}

export function createMetaOciPar(body: Partial<MetaOciPar>): Promise<MetaOciPar> {
  return apiFetch<MetaOciPar>('/api/cadastros/metas-oci-par', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateMetaOciPar(id: number, body: Partial<MetaOciPar>): Promise<MetaOciPar> {
  return apiFetch<MetaOciPar>(`/api/cadastros/metas-oci-par/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function inactivateMetaOciPar(id: number): Promise<void> {
  return apiFetch<void>(`/api/cadastros/metas-oci-par/${id}`, { method: 'DELETE' });
}

export function fetchLeitosVigencias(id: number): Promise<LeitosVigencia[]> {
  return apiFetch<LeitosVigencia[]>(`/api/cadastros/estabelecimentos/${id}/leitos-vigencias`);
}

export function createLeitosVigencia(
  id: number,
  body: LeitosVigenciaInput,
): Promise<LeitosVigencia> {
  return apiFetch<LeitosVigencia>(`/api/cadastros/estabelecimentos/${id}/leitos-vigencias`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateLeitosVigencia(
  id: number,
  vigenciaId: number,
  body: LeitosVigenciaInput,
): Promise<LeitosVigencia> {
  return apiFetch<LeitosVigencia>(
    `/api/cadastros/estabelecimentos/${id}/leitos-vigencias/${vigenciaId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  );
}

export function deleteLeitosVigencia(id: number, vigenciaId: number): Promise<void> {
  return apiFetch<void>(
    `/api/cadastros/estabelecimentos/${id}/leitos-vigencias/${vigenciaId}`,
    { method: 'DELETE' },
  );
}
