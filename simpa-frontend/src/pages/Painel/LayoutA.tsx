import type { ContratoDashboard, Unidade } from '../../types/contrato';
import {
  buildPainelKpis,
  buildRanking,
  buildTrendSeries,
  type RankingRow,
} from '../../utils/dashboardView';
import { EChart, trendOption } from '../../components/charts/LazyEChart';
import { KpiCard } from '../../components/painel/KpiCard';
import { useFilters } from '../../hooks/useFilters';
import { usePainelLayout } from '../../hooks/usePainelLayout';
import {
  mapWidgetToKpi,
  mapWidgetToRanking,
  mapWidgetToTrendSeries,
  splitPainelWidgetsByTipo,
} from '../../utils/painelWidgetsView';

interface LayoutAProps {
  data: ContratoDashboard | null;
  unidades: Unidade[];
}

export function LayoutA({ data, unidades }: LayoutAProps) {
  const { painelPerfil } = useFilters();
  const { layout, loading: layoutLoading, error: layoutError } = usePainelLayout('A');
  const useFallback = Boolean(layoutError) || !layout?.widgets?.length;
  const cardLimit = painelPerfil === 'APS' ? 6 : 9;

  const sortedWidgets = [...(layout?.widgets ?? [])].sort((a, b) => a.ordem - b.ordem);
  const split = splitPainelWidgetsByTipo(sortedWidgets);
  const lineWidget = split.linhas[0];
  const rankingWidget = split.rankings[0];

  const kpis = useFallback
    ? data
      ? buildPainelKpis(data)
      : []
    : split.cards.slice(0, cardLimit).map((widget) => mapWidgetToKpi(widget));

  const trend = useFallback
    ? data
      ? buildTrendSeries(data)
      : []
    : lineWidget
      ? mapWidgetToTrendSeries(lineWidget)
      : [];

  const ranking = useFallback
    ? data
      ? buildRanking(data, unidades)
      : []
    : rankingWidget
      ? mapWidgetToRanking(rankingWidget)
      : [];

  const trendTitle = useFallback ? 'Atendimentos individuais' : lineWidget?.titulo ?? 'Atendimentos individuais';
  const rankingTitle = useFallback
    ? 'Produção por unidade · top 6'
    : rankingWidget?.titulo ?? 'Produção por unidade · top 6';

  return (
    <div className="painel-layout-a" data-testid="layout-a">
      {layoutLoading && !layout?.widgets?.length ? (
        <p className="painel-state-inline">Atualizando indicadores dinâmicos…</p>
      ) : null}
      <div className="kpi-grid-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      <div className="painel-split-grid">
        <section className="card painel-trend-card">
          <div className="painel-section-head">
            <h3>{trendTitle}</h3>
            <span className="mono painel-section-meta">
              {trend[0]?.competencia.slice(5) ?? '—'} — {trend[trend.length - 1]?.competencia.slice(5) ?? '—'}
            </span>
          </div>
          <EChart option={trendOption(trend)} height={200} testId="trend-chart" />
        </section>

        <section className="card painel-ranking-card">
          <h3>{rankingTitle}</h3>
          <div className="ranking-list">
            {ranking.map((row) => (
              <RankingBar key={row.nome} row={row} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function RankingBar({ row }: { row: RankingRow }) {
  return (
    <div className="ranking-row">
      <div className="ranking-row-head">
        <span>{row.nome}</span>
        <span className="mono">{row.valueLabel}</span>
      </div>
      <div className="ranking-track">
        <div className="ranking-fill" style={{ width: `${row.widthPct}%`, background: row.color }} />
      </div>
    </div>
  );
}
