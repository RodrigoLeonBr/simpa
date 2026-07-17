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

export function mapWidgetFormPayload(
  values: Record<string, string>,
  perfil: PainelWidgetPerfil = 'APS',
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
    layout: 'A',
  };
}

export async function fetchPainelWidgetsByPerfilLayoutA(
  perfil: PainelWidgetPerfil,
): Promise<PainelWidgetConfig[]> {
  const data = await fetchPainelWidgets({ perfil, layout: 'A' });
  return [...data].sort((a, b) => a.ordem - b.ordem);
}

/** @deprecated Use fetchPainelWidgetsByPerfilLayoutA('APS') */
export async function fetchPainelWidgetsApsLayoutA(): Promise<PainelWidgetConfig[]> {
  return fetchPainelWidgetsByPerfilLayoutA('APS');
}

export function mapWidgetForTable(row: PainelWidgetConfig): Record<string, unknown> {
  return row as unknown as Record<string, unknown>;
}

export const WIDGET_CRUD_MESSAGES = {
  created: 'Widget criado com sucesso',
  updated: 'Widget atualizado com sucesso',
  inactivated: 'Widget inativado com sucesso',
};
