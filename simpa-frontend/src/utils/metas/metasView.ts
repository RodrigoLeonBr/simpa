import type { IndicadorQualidade } from '../../types/contrato';
import {
  computeAtingimento,
  execBarWidthPct,
  formatAtingimentoText,
  formatExecText,
  formatMetaText,
  metaBarWidthPct,
  META_COLORS,
  resolveMetaStatus,
  type MetaStatus,
} from '../shared/metaStatus';

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
