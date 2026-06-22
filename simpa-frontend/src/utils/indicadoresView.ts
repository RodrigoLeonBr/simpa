export type { MetaStatus, MetaStatusTone } from './shared/metaStatus';
export {
  computeAtingimento,
  execBarWidthPct,
  formatAtingimentoText,
  formatExecText,
  formatMetaText,
  META_COLORS,
  metaBarWidthPct,
  resolveMetaStatus,
} from './shared/metaStatus';

export type { IndicadorEnriched, MetasResumoCard } from './metas/metasView';
export { buildMetasResumo, enrichIndicador } from './metas/metasView';

export type { UnitComparisonRow } from './indicadores/qualidadeView';
export { buildHistoricoSeries, buildUnitComparison } from './indicadores/qualidadeView';

export type { BenchmarkRow, MapPin, RelatSinteseRow } from './relatorios/comparativoView';
export { buildBenchmarkRows, buildMapPins, buildRelatSintese } from './relatorios/comparativoView';
