import type { ContratoDashboard, HistoricoMensal, Unidade } from '../types/contrato';
import { computeDelta, EM_DASH, formatKpi, isNullKpi, type KpiDelta } from './kpi';

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

function historicoSorted(data: ContratoDashboard): HistoricoMensal[] {
  const historico = data.modulos?.atencao_primaria_esus?.historico_mensal;
  if (!historico?.length) return [];
  return [...historico].sort((a, b) => a.competencia.localeCompare(b.competencia));
}

function sparkFromHistorico(historico: HistoricoMensal[], field: keyof HistoricoMensal): number[] {
  return historico.map((item) => {
    const value = item[field];
    return typeof value === 'number' ? value : 0;
  });
}

interface FinanciamentoIndicadorLike {
  valor: number | null;
  meta: number | null;
}

function resolveFinanciamentoIndicadores(data: ContratoDashboard): FinanciamentoIndicadorLike[] {
  const fin = data.modulos?.financiamento_metas as
    | {
        indicadores?: FinanciamentoIndicadorLike[];
        componente_qualidade_aps?: { indicadores?: FinanciamentoIndicadorLike[] } | FinanciamentoIndicadorLike[];
        igm_sus_paulista?: { indicadores?: FinanciamentoIndicadorLike[] } | FinanciamentoIndicadorLike[];
      }
    | undefined;

  if (!fin) return [];

  if (Array.isArray(fin.indicadores)) {
    return fin.indicadores;
  }

  const items: FinanciamentoIndicadorLike[] = [];

  if (fin.componente_qualidade_aps && !Array.isArray(fin.componente_qualidade_aps)) {
    const apsItems = fin.componente_qualidade_aps.indicadores;
    if (Array.isArray(apsItems)) items.push(...apsItems);
  }

  if (fin.igm_sus_paulista && !Array.isArray(fin.igm_sus_paulista)) {
    const igmItems = fin.igm_sus_paulista.indicadores;
    if (Array.isArray(igmItems)) items.push(...igmItems);
  }

  return items;
}

function countMetasAtingidas(data: ContratoDashboard): number | null {
  const items = resolveFinanciamentoIndicadores(data);
  const valid = items.filter((item) => item.valor !== null && item.meta !== null);
  if (valid.length === 0) return null;
  return valid.filter((item) => (item.valor ?? 0) >= (item.meta ?? 0)).length;
}

function countMetasTotal(data: ContratoDashboard): number | null {
  const items = resolveFinanciamentoIndicadores(data);
  const valid = items.filter((item) => item.meta !== null || item.valor !== null);
  if (valid.length === 0) return null;
  return valid.length;
}

export function buildPainelKpis(data: ContratoDashboard): PainelKpi[] {
  const historico = historicoSorted(data);
  const prev = historico.length > 1 ? historico[historico.length - 2] : null;
  const curr = historico.length > 0 ? historico[historico.length - 1] : null;
  const metasAtingidas = countMetasAtingidas(data);
  const metasTotal = countMetasTotal(data);

  const atendimentos = data.kpis_gerais?.total_atendimentos_aps ?? null;
  const odonto = data.kpis_gerais?.atendimentos_odonto ?? null;
  const coletivas = data.kpis_gerais?.total_participantes_coletivos ?? null;

  const metasLabel =
    metasAtingidas === null || metasTotal === null ? EM_DASH : `${metasAtingidas} / ${metasTotal}`;

  const defs: Array<Omit<PainelKpi, 'sparkSeries'> & { sparkField?: keyof HistoricoMensal }> = [
    {
      id: 'atendimentos',
      label: 'Atendimentos individuais',
      value: formatKpi(atendimentos),
      raw: atendimentos,
      isNull: isNullKpi(atendimentos),
      delta: computeDelta(atendimentos, prev?.atendimentos ?? null),
      sparkField: 'atendimentos',
    },
    {
      id: 'cobertura',
      label: 'Cobertura APS',
      value: EM_DASH,
      raw: null,
      isNull: true,
      delta: { label: 'Não apurado', direction: 'flat' },
    },
    {
      id: 'equipes',
      label: 'Equipes ativas',
      value: EM_DASH,
      raw: null,
      isNull: true,
      delta: { label: '—', direction: 'flat' },
    },
    {
      id: 'metas',
      label: 'Metas atingidas',
      value: metasLabel,
      raw: metasAtingidas,
      isNull: metasAtingidas === null,
      delta: { label: 'Comp. Qualidade', direction: 'flat' },
    },
    {
      id: 'odonto',
      label: 'Produção odontológica',
      value: formatKpi(odonto),
      raw: odonto,
      isNull: isNullKpi(odonto),
      delta: computeDelta(odonto, prev?.procedimentos ?? null),
      sparkField: 'procedimentos',
    },
    {
      id: 'coletivas',
      label: 'Atividades coletivas',
      value: formatKpi(coletivas),
      raw: coletivas,
      isNull: isNullKpi(coletivas),
      delta: computeDelta(coletivas, curr?.atendimentos ?? null),
      sparkField: 'atendimentos',
    },
  ];

  return defs.map((item) => ({
    ...item,
    sparkSeries: item.sparkField ? sparkFromHistorico(historico, item.sparkField) : [],
  }));
}

export function buildTrendSeries(data: ContratoDashboard): TrendPoint[] {
  return historicoSorted(data).map((item) => ({
    competencia: item.competencia,
    atendimentos: item.atendimentos,
    meta: item.meta,
  }));
}

export function buildRanking(data: ContratoDashboard, unidades: Unidade[]): RankingRow[] {
  const activeUnit = data.filtros_ativos?.unidade;
  const baseValue = data.kpis_gerais?.total_atendimentos_aps ?? 0;

  const rows = unidades
    .filter((unit) => unit.status !== 'inativo')
    .map((unit, index) => {
      const isActive = unit.nome === activeUnit;
      const value = isActive ? baseValue : Math.round(baseValue * (0.55 - index * 0.08));
      return {
        nome: unit.nome,
        value: Math.max(value, 0),
        valueLabel: formatKpi(isActive ? baseValue : value || null),
        widthPct: 0,
        color: 'var(--brand)',
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const max = rows[0]?.value || 1;
  return rows.map((row) => ({
    ...row,
    widthPct: Math.round((row.value / max) * 100),
  }));
}

export function buildUnitTable(data: ContratoDashboard, unidades: Unidade[]): UnitTableRow[] {
  const activeUnit = data.filtros_ativos?.unidade;
  const metasAtingidas = countMetasAtingidas(data);
  const metasTotal = countMetasTotal(data);
  const metasText =
    metasAtingidas === null || metasTotal === null ? EM_DASH : `${metasAtingidas}/${metasTotal}`;
  const metasColor = metasAtingidas === null ? 'var(--amber)' : 'var(--green)';

  return unidades
    .filter((unit) => unit.status !== 'inativo')
    .map((unit) => {
      const isActive = unit.nome === activeUnit;
      const atendimentos = isActive ? (data.kpis_gerais?.total_atendimentos_aps ?? null) : null;
      const odonto = isActive ? (data.kpis_gerais?.atendimentos_odonto ?? null) : null;

      return {
        nome: unit.nome,
        tipo: unit.tipo,
        atendimentos: formatKpi(atendimentos),
        odonto: formatKpi(odonto),
        cobertura: EM_DASH,
        metas: isActive ? metasText : EM_DASH,
        metasColor: isActive ? metasColor : 'var(--amber)',
        isNull: !isActive || isNullKpi(atendimentos),
      };
    });
}

export function buildModuleStatuses(data: ContratoDashboard): ModuleStatus[] {
  const siaStatus = data.modulos?.ambulatorial_sia?.status_conexao ?? 'UNKNOWN';
  const sihdStatus = data.modulos?.hospitalar_sihd?.status_importacao ?? 'UNKNOWN';

  const siaTone =
    siaStatus.includes('CONNECTED') || siaStatus.includes('ATIVO')
      ? 'green'
      : siaStatus.includes('UNAVAILABLE')
        ? 'red'
        : 'amber';

  const sihdTone = sihdStatus.includes('PENDING') ? 'amber' : sihdStatus.includes('OK') ? 'green' : 'red';

  return [
    {
      id: 'sia',
      label: 'SIA · MAC',
      status: siaTone === 'green' ? 'Conectado' : siaStatus.replace(/_/g, ' '),
      tone: siaTone,
    },
    {
      id: 'sihd',
      label: 'SIHD · AIH',
      status: sihdStatus.includes('PENDING') ? 'Pendente' : sihdStatus.replace(/_/g, ' '),
      tone: sihdTone,
    },
  ];
}
