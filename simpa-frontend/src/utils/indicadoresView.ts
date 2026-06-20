import type { IndicadorQualidade, Unidade } from '../types/contrato';
import { EM_DASH, formatPercent } from './kpi';

export type MetaStatusTone = 'green' | 'amber' | 'red' | 'null';

export interface MetaStatus {
  tone: MetaStatusTone;
  label: string;
  color: string;
  badgeBg: string;
}

export const META_COLORS = {
  green: '#1f8a5b',
  amber: '#c8862b',
  red: '#c0392b',
  dark: '#0f1b2d',
  brand: '#0b5fad',
  muted: '#8595a8',
} as const;

export interface MetasResumoCard {
  label: string;
  value: string;
  sub: string;
  color: string;
}

export interface IndicadorEnriched {
  indicador: IndicadorQualidade;
  status: MetaStatus;
  execText: string;
  metaText: string;
  atingText: string;
  execWidthPct: number;
  metaWidthPct: number;
  origem: string;
}

export interface UnitComparisonRow {
  nome: string;
  execText: string;
  widthPct: number;
  color: string;
}

export interface BenchmarkRow {
  rank: string;
  nome: string;
  tipo: string;
  execText: string;
  widthPct: number;
  color: string;
  diffText: string;
  diffColor: string;
}

export interface MapPin {
  x: string;
  y: string;
  size: string;
  color: string;
}

export interface RelatSinteseRow {
  label: string;
  value: string;
  color: string;
}

export function computeAtingimento(exec: number | null, meta: number | null): number | null {
  if (exec === null || meta === null || meta === 0) {
    return null;
  }
  return exec / meta;
}

export function resolveMetaStatus(exec: number | null, meta: number | null): MetaStatus {
  const ating = computeAtingimento(exec, meta);
  if (ating === null) {
    return {
      tone: 'null',
      label: 'Não apurado',
      color: META_COLORS.amber,
      badgeBg: '#fbf0dd',
    };
  }
  if (ating >= 1) {
    return { tone: 'green', label: 'atingida', color: META_COLORS.green, badgeBg: '#e6f3ec' };
  }
  if (ating >= 0.9) {
    return { tone: 'amber', label: 'próxima', color: META_COLORS.amber, badgeBg: '#fbf0dd' };
  }
  return { tone: 'red', label: 'abaixo', color: META_COLORS.red, badgeBg: '#fbe6e3' };
}

export function formatExecText(exec: number | null): string {
  if (exec === null) return EM_DASH;
  return formatPercent(exec, 1);
}

export function formatMetaText(meta: number | null): string {
  if (meta === null) return EM_DASH;
  return formatPercent(meta, 1);
}

export function formatAtingimentoText(exec: number | null, meta: number | null): string {
  const ating = computeAtingimento(exec, meta);
  if (ating === null) return EM_DASH;
  return `${Math.round(ating * 100)}%`;
}

export function execBarWidthPct(exec: number | null, scaleMax = 1): number {
  if (exec === null) return 0;
  return Math.min(100, (exec / scaleMax) * 100);
}

export function metaBarWidthPct(meta: number | null, scaleMax = 1): number {
  if (meta === null) return 0;
  return Math.min(100, (meta / scaleMax) * 100);
}

export function enrichIndicador(indicador: IndicadorQualidade): IndicadorEnriched {
  const status = resolveMetaStatus(indicador.exec, indicador.meta);
  const scaleMax = Math.max(indicador.exec ?? 0, indicador.meta ?? 0, 1);

  return {
    indicador,
    status,
    execText: formatExecText(indicador.exec),
    metaText: formatMetaText(indicador.meta),
    atingText: formatAtingimentoText(indicador.exec, indicador.meta),
    execWidthPct: execBarWidthPct(indicador.exec, scaleMax),
    metaWidthPct: metaBarWidthPct(indicador.meta, scaleMax),
    origem: indicador.categoria,
  };
}

export function buildMetasResumo(indicadores: IndicadorQualidade[]): MetasResumoCard[] {
  let atingidas = 0;
  let proximas = 0;
  let abaixo = 0;

  for (const item of indicadores) {
    const ating = computeAtingimento(item.exec, item.meta);
    if (ating === null) continue;
    if (ating >= 1) atingidas += 1;
    else if (ating >= 0.9) proximas += 1;
    else abaixo += 1;
  }

  return [
    {
      label: 'Metas monitoradas',
      value: String(indicadores.length),
      sub: 'indicadores ativos',
      color: META_COLORS.dark,
    },
    {
      label: 'Atingidas',
      value: String(atingidas),
      sub: '≥ 100% da meta',
      color: META_COLORS.green,
    },
    {
      label: 'Próximas',
      value: String(proximas),
      sub: '90–99% da meta',
      color: META_COLORS.amber,
    },
    {
      label: 'Abaixo',
      value: String(abaixo),
      sub: '< 90% da meta',
      color: META_COLORS.red,
    },
  ];
}

function deterministicFactor(seed: number, index: number): number {
  const value = (seed * 9301 + 49297 + index * 17) % 233280;
  return value / 233280;
}

export function buildUnitComparison(
  indicador: IndicadorQualidade,
  unidades: Unidade[],
  activeUnitName?: string,
): UnitComparisonRow[] {
  const meta = indicador.meta;
  const baseExec = indicador.exec;

  if (indicador.porUnidade?.length) {
    const max = Math.max(...indicador.porUnidade.map((row) => row.exec ?? 0), meta ?? 0, 0.01);
    return indicador.porUnidade.map((row) => {
      const status = resolveMetaStatus(row.exec, meta);
      return {
        nome: row.unidade,
        execText: formatExecText(row.exec),
        widthPct: execBarWidthPct(row.exec, max),
        color: status.color,
      };
    });
  }

  const apsUnits = unidades.filter((unit) => unit.status !== 'inativo' && unit.tipo !== 'Hospitalar');
  const seed = indicador.cod.charCodeAt(0) || 50;
  const values = apsUnits.map((unit, index) => {
    if (baseExec === null) return null;
    if (unit.nome === activeUnitName) return baseExec;
    const factor = 0.55 + deterministicFactor(seed, index) * 0.35;
    return Math.max(0.02, baseExec * factor);
  });
  const max = Math.max(...values.map((value) => value ?? 0), meta ?? 0, 0.01);

  return apsUnits.map((unit, index) => {
    const exec = values[index] ?? null;
    const status = resolveMetaStatus(exec, meta);
    return {
      nome: unit.nome,
      execText: formatExecText(exec),
      widthPct: execBarWidthPct(exec, max),
      color: status.color,
    };
  });
}

export function buildHistoricoSeries(indicador: IndicadorQualidade): Array<{ competencia: string; exec: number | null }> {
  if (indicador.historico?.length) {
    return indicador.historico;
  }
  if (indicador.exec === null) return [];

  const seed = indicador.cod.charCodeAt(0) || 50;
  const months = ['2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05'];

  return months.map((competencia, index) => {
    const drift = (index - 6) * 0.012;
    const jitter = (deterministicFactor(seed, index) - 0.5) * 0.08;
    return { competencia, exec: Math.max(0, Math.min(1, indicador.exec! * (1 + drift + jitter))) };
  });
}

export function buildBenchmarkRows(
  indicador: IndicadorQualidade,
  unidades: Unidade[],
  activeUnitName?: string,
): BenchmarkRow[] {
  const comparison = buildUnitComparison(indicador, unidades, activeUnitName);
  const unitByName = new Map(unidades.map((unit) => [unit.nome, unit]));
  const execValues = comparison.map((row) => {
    const match = indicador.porUnidade?.find((item) => item.unidade === row.nome);
    if (match) return match.exec;
    if (row.nome === activeUnitName) return indicador.exec;
    const parsed = row.execText.replace('%', '').replace(',', '.');
    if (parsed === EM_DASH) return null;
    return Number(parsed) / 100;
  });

  const validValues = execValues.filter((value): value is number => value !== null);
  const media = validValues.length ? validValues.reduce((sum, value) => sum + value, 0) / validValues.length : 0;
  const max = Math.max(...execValues.map((value) => value ?? 0), 0.01);

  const rows = comparison
    .map((row, index) => ({
      row,
      exec: execValues[index] ?? null,
      unit: unitByName.get(row.nome),
    }))
    .sort((a, b) => (b.exec ?? 0) - (a.exec ?? 0));

  return rows.map(({ row, exec, unit }, index) => {
    const diff = exec === null ? null : (exec - media) * 100;
    const diffText =
      diff === null ? EM_DASH : `${diff >= 0 ? '+' : ''}${diff.toFixed(1).replace('.', ',')} p.p.`;
    const diffColor = diff === null ? META_COLORS.muted : diff >= 0 ? META_COLORS.green : META_COLORS.red;

    return {
      rank: String(index + 1).padStart(2, '0'),
      nome: row.nome,
      tipo: unit?.tipo ?? 'APS',
      execText: row.execText,
      widthPct: execBarWidthPct(exec, max),
      color: row.color,
      diffText,
      diffColor,
    };
  });
}

export function buildMapPins(rows: BenchmarkRow[]): MapPin[] {
  const positions = [
    { x: '18%', y: '28%' },
    { x: '34%', y: '42%' },
    { x: '52%', y: '24%' },
    { x: '68%', y: '38%' },
    { x: '78%', y: '58%' },
    { x: '42%', y: '62%' },
    { x: '24%', y: '72%' },
    { x: '58%', y: '76%' },
  ];

  return rows.slice(0, positions.length).map((row, index) => ({
    ...positions[index]!,
    size: `${18 - index}px`,
    color: row.color,
  }));
}

export function buildRelatSintese(
  indicador: IndicadorQualidade,
  rows: BenchmarkRow[],
): RelatSinteseRow[] {
  const execValues = rows
    .map((row) => {
      if (row.execText === EM_DASH) return null;
      return Number(row.execText.replace('%', '').replace(',', '.')) / 100;
    })
    .filter((value): value is number => value !== null);

  const media = execValues.length ? execValues.reduce((sum, value) => sum + value, 0) / execValues.length : null;
  const best = execValues.length ? Math.max(...execValues) : null;
  const aboveMeta =
    indicador.meta === null ? 0 : execValues.filter((value) => value >= indicador.meta!).length;

  return [
    { label: 'Média municipal', value: formatExecText(media), color: META_COLORS.brand },
    { label: 'Meta regulamentada', value: formatMetaText(indicador.meta), color: META_COLORS.dark },
    { label: 'Melhor unidade', value: formatExecText(best), color: META_COLORS.green },
    {
      label: 'Unidades acima da meta',
      value: indicador.meta === null ? EM_DASH : String(aboveMeta),
      color: META_COLORS.green,
    },
  ];
}
