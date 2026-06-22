import type { IndicadorQualidade, Unidade } from '../../types/contrato';
import {
  execBarWidthPct,
  formatExecText,
  resolveMetaStatus,
} from '../shared/metaStatus';

export interface UnitComparisonRow {
  nome: string;
  execText: string;
  widthPct: number;
  color: string;
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

export function buildHistoricoSeries(
  indicador: IndicadorQualidade,
): Array<{ competencia: string; exec: number | null }> {
  if (indicador.historico?.length) {
    return indicador.historico;
  }
  if (indicador.exec === null) return [];

  const seed = indicador.cod.charCodeAt(0) || 50;
  const months = [
    '2025-06',
    '2025-07',
    '2025-08',
    '2025-09',
    '2025-10',
    '2025-11',
    '2025-12',
    '2026-01',
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-05',
  ];

  return months.map((competencia, index) => {
    const drift = (index - 6) * 0.012;
    const jitter = (deterministicFactor(seed, index) - 0.5) * 0.08;
    return { competencia, exec: Math.max(0, Math.min(1, indicador.exec! * (1 + drift + jitter))) };
  });
}
