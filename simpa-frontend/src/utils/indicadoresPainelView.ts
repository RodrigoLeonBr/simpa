import { fetchPainelWidgets } from '../api/painelWidgets';
import type { CadastroFieldDef } from '../config/cadastroEntities';
import type { PainelWidgetConfig } from '../types/painelWidgets';

export function canEditIndicadoresPainel(perfil: string | undefined): boolean {
  return perfil === 'Administrador' || perfil === 'Planejamento';
}

export function formatWidgetTipo(tipo: PainelWidgetConfig['tipo']): string {
  if (tipo === 'card') return 'Card';
  if (tipo === 'grafico_linha') return 'Linha';
  if (tipo === 'grafico_ranking') return 'Ranking';
  return 'Barra';
}

export const WIDGET_FIELDS: CadastroFieldDef[] = [
  { key: 'slug', label: 'Slug', required: true, mono: true },
  { key: 'titulo', label: 'Título', required: true },
  { key: 'subtitulo', label: 'Subtítulo' },
  { key: 'tipo', label: 'Tipo', required: true, type: 'select' },
  { key: 'formato', label: 'Formato', required: true, type: 'select' },
  { key: 'metrica_id', label: 'Métrica principal', required: true, type: 'select' },
  { key: 'spark_metrica_id', label: 'Métrica sparkline (opcional)', type: 'select' },
];

export const WIDGET_TIPO_SELECT_OPTIONS = [
  { value: 'card', label: 'Card' },
  { value: 'grafico_linha', label: 'Linha' },
  { value: 'grafico_ranking', label: 'Ranking' },
  { value: 'grafico_barra', label: 'Barra' },
];

export const WIDGET_FORMATO_SELECT_OPTIONS = [
  { value: 'numero', label: 'Número' },
  { value: 'percentual', label: 'Percentual' },
  { value: 'moeda', label: 'Moeda' },
  { value: 'texto', label: 'Texto' },
  { value: 'fracao', label: 'Fração' },
];

export function widgetRowToFormValues(row?: PainelWidgetConfig | null): Record<string, string> {
  if (!row) {
    return {
      slug: '',
      titulo: '',
      subtitulo: '',
      tipo: 'card',
      formato: 'numero',
      metrica_id: '',
      spark_metrica_id: '',
    };
  }

  return {
    slug: row.slug,
    titulo: row.titulo,
    subtitulo: row.subtitulo ?? '',
    tipo: row.tipo,
    formato: row.formato,
    metrica_id: row.metrica_id ? String(row.metrica_id) : '',
    spark_metrica_id: row.spark_metrica_id ? String(row.spark_metrica_id) : '',
  };
}

export const PAINEL_WIDGET_PERFIS = ['APS', 'MAC', 'Hospitalar'] as const;

export type PainelWidgetPerfil = (typeof PAINEL_WIDGET_PERFIS)[number];

export const PAINEL_WIDGET_LAYOUTS = [
  { id: 'A', label: 'A · Cards' },
  { id: 'B', label: 'B · Foco' },
  { id: 'C', label: 'C · Tabela' },
] as const;

export type PainelWidgetLayout = (typeof PAINEL_WIDGET_LAYOUTS)[number]['id'];

export function formatPainelWidgetLayoutLabel(layout: PainelWidgetLayout): string {
  return PAINEL_WIDGET_LAYOUTS.find((item) => item.id === layout)?.label ?? `Layout ${layout}`;
}

export function mapWidgetFormPayload(
  values: Record<string, string>,
  perfil: PainelWidgetPerfil = 'APS',
  layout: PainelWidgetLayout = 'A',
): Partial<PainelWidgetConfig> {
  return {
    slug: values.slug.trim(),
    titulo: values.titulo.trim(),
    subtitulo: values.subtitulo.trim() || null,
    tipo: values.tipo as PainelWidgetConfig['tipo'],
    formato: values.formato as PainelWidgetConfig['formato'],
    metrica_id: values.metrica_id ? Number(values.metrica_id) : null,
    spark_metrica_id: values.spark_metrica_id ? Number(values.spark_metrica_id) : null,
    perfil,
    layout,
  };
}

export async function fetchPainelWidgetsByPerfilLayout(
  perfil: PainelWidgetPerfil,
  layout: PainelWidgetLayout,
): Promise<PainelWidgetConfig[]> {
  const data = await fetchPainelWidgets({ perfil, layout, includeInactive: true });
  return [...data].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
}

/** @deprecated Use fetchPainelWidgetsByPerfilLayout(perfil, 'A') */
export async function fetchPainelWidgetsByPerfilLayoutA(
  perfil: PainelWidgetPerfil,
): Promise<PainelWidgetConfig[]> {
  return fetchPainelWidgetsByPerfilLayout(perfil, 'A');
}

export function swapWidgetOrderIds(
  rows: PainelWidgetConfig[],
  index: number,
  direction: 'up' | 'down',
): number[] {
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= rows.length) {
    return rows.map((row) => row.id);
  }
  const ids = rows.map((row) => row.id);
  [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
  return ids;
}

/** @deprecated Use fetchPainelWidgetsByPerfilLayoutA('APS') */
export async function fetchPainelWidgetsApsLayoutA(): Promise<PainelWidgetConfig[]> {
  return fetchPainelWidgetsByPerfilLayoutA('APS');
}

export function mapWidgetForTable(row: PainelWidgetConfig): Record<string, unknown> {
  return row as unknown as Record<string, unknown>;
}

export function formatDiscoverCatalogToast(result: {
  inserted: number;
  updated: number;
  sources?: {
    esus_raw?: { inserted: number; updated: number };
    sia?: { inserted: number; updated: number };
    sih?: { inserted: number; updated: number };
  };
}): string {
  const base = `Catálogo atualizado — ${result.inserted} inseridas, ${result.updated} atualizadas`;
  const parts = [
    result.sources?.esus_raw
      ? `e-SUS: ${result.sources.esus_raw.inserted}/${result.sources.esus_raw.updated}`
      : null,
    result.sources?.sia ? `SIA: ${result.sources.sia.inserted}/${result.sources.sia.updated}` : null,
    result.sources?.sih ? `SIHD: ${result.sources.sih.inserted}/${result.sources.sih.updated}` : null,
  ].filter(Boolean);

  return parts.length ? `${base} (${parts.join(' · ')})` : base;
}

export const WIDGET_CRUD_MESSAGES = {
  created: 'Widget criado com sucesso',
  updated: 'Widget atualizado com sucesso',
  inactivated: 'Widget inativado com sucesso',
  reactivated: 'Widget reativado com sucesso',
  reordered: 'Ordem dos widgets atualizada',
};
