export type {
  ModuleStatus,
  PainelKpi,
  PainelLayout,
  RankingRow,
  TrendPoint,
  UnitTableRow,
} from './types';

export {
  getPainelCatalogStatus,
  isDynamicPainelPerfil,
  isPainelCatalogReady,
  needsConsolidatedDashboard,
  PAINEL_KPI_CATALOGS,
  resolvePainelViewContext,
} from './catalogView';

export { buildPainelKpis } from './kpiView';
export { buildTrendSeries } from './trendView';
export { buildRanking } from './rankingView';
export { buildUnitTable } from './tableView';
export { buildModuleStatuses } from './moduleStatusView';
