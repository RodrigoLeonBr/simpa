import type { PaginatedResponse } from './cadastros';

export type PainelWidgetTipo =
  | 'card'
  | 'grafico_linha'
  | 'grafico_ranking'
  | 'grafico_barra';

export type PainelWidgetFormato =
  | 'numero'
  | 'percentual'
  | 'moeda'
  | 'texto'
  | 'fracao';

export interface PainelMetricaCatalogo {
  id: number;
  chave: string;
  fonte_tipo: 'esus_raw' | 'sia' | 'consolidado' | 'meta' | 'placeholder';
  label: string;
  descricao: string | null;
  tipo_relatorio: string | null;
  agregacao: string;
  sql_template: string;
  ocorrencias: number;
  status: string;
}

export interface PainelWidgetConfig {
  id: number;
  slug: string;
  perfil: string;
  layout: string;
  ordem: number;
  tipo: PainelWidgetTipo;
  titulo: string;
  subtitulo: string | null;
  formato: PainelWidgetFormato;
  metrica_id: number | null;
  metrica?: PainelMetricaCatalogo;
  fonte_config: Record<string, unknown>;
  spark_metrica_id: number | null;
  spark_config: Record<string, unknown> | null;
  sql_preview: string | null;
  delta_config: Record<string, unknown> | null;
  status: string;
}

export interface ResolvedPainelWidget {
  slug: string;
  ordem: number;
  tipo: PainelWidgetTipo;
  titulo: string;
  subtitulo: string | null;
  formato: PainelWidgetFormato;
  value: number | null;
  valueLabel: string;
  isNull: boolean;
  delta?: { label: string; direction: 'up' | 'down' | 'flat' };
  sparkSeries?: number[];
  series?: Array<{ competencia: string; valor: number }>;
  ranking?: Array<{
    label: string;
    valor: number;
    valueLabel: string;
    estabelecimento_id?: number;
  }>;
}

export interface PainelLayoutResponse {
  perfil: string;
  layout: string;
  competencia: string;
  widgets: ResolvedPainelWidget[];
}

export interface FetchPainelLayoutParams {
  competencia: string;
  perfil?: string;
  layout?: string;
  estabelecimentoId?: number;
  equipeId?: number;
}

export interface FetchPainelWidgetsParams {
  perfil?: string;
  layout?: string;
  includeInactive?: boolean;
}

export interface ReorderPainelWidgetsPayload {
  perfil: string;
  layout: string;
  orderedIds: number[];
}

export interface PreviewPainelWidgetParams {
  widgetId?: number;
  widget?: Partial<PainelWidgetConfig>;
  scope?: {
    competencia: string;
    estabelecimentoId?: number;
    equipeId?: number;
  };
}

export interface FetchPainelMetricasParams {
  q?: string;
  fonte_tipo?: PainelMetricaCatalogo['fonte_tipo'];
  page?: number;
  limit?: number;
}

export type PainelMetricasListResponse = PaginatedResponse<PainelMetricaCatalogo>;

export interface ApiErrorResponse {
  error: string;
  code?: string;
}
