import { apiFetch } from './client';
import type {
  FetchPainelLayoutParams,
  FetchPainelMetricasParams,
  FetchPainelWidgetsParams,
  PainelLayoutResponse,
  PainelMetricaCatalogo,
  PainelMetricasListResponse,
  PainelWidgetConfig,
  PreviewPainelWidgetParams,
  ReorderPainelWidgetsPayload,
  ResolvedPainelWidget,
} from '../types/painelWidgets';

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function fetchPainelLayout({
  competencia,
  perfil = 'APS',
  layout = 'A',
  estabelecimentoId,
  equipeId,
}: FetchPainelLayoutParams): Promise<PainelLayoutResponse> {
  const query = buildQuery({
    competencia,
    perfil,
    layout,
    estabelecimento_id: estabelecimentoId,
    equipe_id: equipeId,
  });
  return apiFetch<PainelLayoutResponse>(`/api/v1/dashboard/painel-layout${query}`);
}

export function fetchPainelWidgets({
  perfil = 'APS',
  layout = 'A',
  includeInactive,
}: FetchPainelWidgetsParams = {}): Promise<PainelWidgetConfig[]> {
  const query = buildQuery({
    perfil,
    layout,
    include_inactive: includeInactive ? 'true' : undefined,
  });
  return apiFetch<PainelWidgetConfig[]>(`/api/cadastros/painel-widgets${query}`);
}

export function fetchPainelWidget(id: number): Promise<PainelWidgetConfig> {
  return apiFetch<PainelWidgetConfig>(`/api/cadastros/painel-widgets/${id}`);
}

export function createPainelWidget(
  body: Partial<PainelWidgetConfig>
): Promise<PainelWidgetConfig> {
  return apiFetch<PainelWidgetConfig>('/api/cadastros/painel-widgets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updatePainelWidget(
  id: number,
  body: Partial<PainelWidgetConfig>
): Promise<PainelWidgetConfig> {
  return apiFetch<PainelWidgetConfig>(`/api/cadastros/painel-widgets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function reorderPainelWidgets(
  body: ReorderPainelWidgetsPayload
): Promise<PainelWidgetConfig[]> {
  return apiFetch<PainelWidgetConfig[]>('/api/cadastros/painel-widgets/reorder', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function inactivatePainelWidget(id: number): Promise<{ id: number; status: string }> {
  return apiFetch<{ id: number; status: string }>(`/api/cadastros/painel-widgets/${id}`, {
    method: 'DELETE',
  });
}

export function previewPainelWidget(
  body: PreviewPainelWidgetParams
): Promise<ResolvedPainelWidget> {
  return apiFetch<ResolvedPainelWidget>('/api/cadastros/painel-widgets/preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchPainelMetricas(
  params: FetchPainelMetricasParams = {}
): Promise<PainelMetricasListResponse> {
  const query = buildQuery({
    q: params.q,
    fonte_tipo: params.fonte_tipo,
    page: params.page,
    limit: params.limit,
  });
  return apiFetch<PainelMetricasListResponse>(`/api/cadastros/painel-metricas${query}`);
}

export function fetchPainelMetrica(id: number): Promise<PainelMetricaCatalogo> {
  return apiFetch<PainelMetricaCatalogo>(`/api/cadastros/painel-metricas/${id}`);
}

export function discoverPainelMetricas(): Promise<{
  inserted: number;
  updated: number;
  sources?: {
    esus_raw: { inserted: number; updated: number };
    sia: { inserted: number; updated: number };
    sih: { inserted: number; updated: number };
  };
}> {
  return apiFetch<{
    inserted: number;
    updated: number;
    sources?: {
      esus_raw: { inserted: number; updated: number };
      sia: { inserted: number; updated: number };
      sih: { inserted: number; updated: number };
    };
  }>('/api/cadastros/painel-metricas/descobrir', {
    method: 'POST',
  });
}
