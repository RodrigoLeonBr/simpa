import type { IndicadorQualidade, Unidade } from '../../types/contrato';
import { EM_DASH } from '../kpi';
import {
  execBarWidthPct,
  formatExecText,
  formatMetaText,
  META_COLORS,
} from '../shared/metaStatus';
import { buildUnitComparison } from '../indicadores/qualidadeView';

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
