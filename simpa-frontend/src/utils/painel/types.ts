import type { KpiDelta } from '../kpi';

export type PainelLayout = 'A' | 'B' | 'C';

export interface PainelKpi {
  id: string;
  label: string;
  value: string;
  raw: number | null;
  isNull: boolean;
  delta: KpiDelta;
  sparkSeries: number[];
}

export interface RankingRow {
  nome: string;
  value: number;
  valueLabel: string;
  widthPct: number;
  color: string;
}

export interface UnitTableRow {
  nome: string;
  tipo: string;
  atendimentos: string;
  odonto: string;
  cobertura: string;
  metas: string;
  metasColor: string;
  isNull: boolean;
}

export interface ModuleStatus {
  id: 'sia' | 'sihd';
  label: string;
  status: string;
  tone: 'green' | 'amber' | 'red';
}

export interface TrendPoint {
  competencia: string;
  atendimentos: number;
  meta: number | null;
}
