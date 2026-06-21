import type { ResolvedPainelWidget } from '../types/painelWidgets';
import type { PainelKpi, RankingRow, TrendPoint } from './dashboardView';
import { EM_DASH, isNullKpi } from './kpi';

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function mapWidgetToKpi(resolved: ResolvedPainelWidget): PainelKpi {
  const raw = toNumber(resolved.value);
  const isNull = resolved.isNull || isNullKpi(raw);
  const value =
    !isNull && resolved.formato === 'fracao' && resolved.valueLabel
      ? resolved.valueLabel
      : isNull
        ? EM_DASH
        : resolved.valueLabel || EM_DASH;

  return {
    id: resolved.slug,
    label: resolved.titulo,
    value,
    raw,
    isNull,
    delta: resolved.delta ?? { label: EM_DASH, direction: 'flat' },
    sparkSeries: Array.isArray(resolved.sparkSeries)
      ? resolved.sparkSeries.filter((point) => typeof point === 'number' && Number.isFinite(point))
      : [],
  };
}

export function mapWidgetToTrendSeries(resolved: ResolvedPainelWidget): TrendPoint[] {
  if (!Array.isArray(resolved.series)) {
    return [];
  }

  return resolved.series
    .filter(
      (point) =>
        typeof point?.competencia === 'string' &&
        typeof point?.valor === 'number' &&
        Number.isFinite(point.valor)
    )
    .map((point) => ({
      competencia: point.competencia,
      atendimentos: point.valor,
      meta: null,
    }));
}

export function mapWidgetToRanking(
  resolved: ResolvedPainelWidget,
  options?: { limit?: number; color?: string }
): RankingRow[] {
  if (!Array.isArray(resolved.ranking) || resolved.ranking.length === 0) {
    return [];
  }

  const limit = options?.limit && options.limit > 0 ? options.limit : 6;
  const color = options?.color ?? 'var(--brand)';

  const rows = resolved.ranking
    .filter((item) => typeof item?.label === 'string' && Number.isFinite(item?.valor))
    .slice(0, limit)
    .map((item) => ({
      nome: item.label,
      value: item.valor,
      valueLabel: item.valueLabel || EM_DASH,
      widthPct: 0,
      color,
    }));

  const max = rows[0]?.value || 1;
  return rows.map((row) => ({
    ...row,
    widthPct: Math.round((row.value / max) * 100),
  }));
}

export interface PainelWidgetsSplit {
  cards: ResolvedPainelWidget[];
  linhas: ResolvedPainelWidget[];
  rankings: ResolvedPainelWidget[];
  outros: ResolvedPainelWidget[];
}

export function splitPainelWidgetsByTipo(widgets: ResolvedPainelWidget[]): PainelWidgetsSplit {
  return widgets.reduce<PainelWidgetsSplit>(
    (acc, widget) => {
      if (widget.tipo === 'card') {
        acc.cards.push(widget);
      } else if (widget.tipo === 'grafico_linha') {
        acc.linhas.push(widget);
      } else if (widget.tipo === 'grafico_ranking') {
        acc.rankings.push(widget);
      } else {
        acc.outros.push(widget);
      }
      return acc;
    },
    { cards: [], linhas: [], rankings: [], outros: [] }
  );
}
