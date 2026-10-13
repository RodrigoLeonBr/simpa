import type { ResolvedPainelWidget } from '../../types/painelWidgets';
import {
  mapWidgetToKpi,
  mapWidgetToRanking,
  mapWidgetToTrendSeries,
  splitPainelWidgetsByTipo,
} from '../../utils/painelWidgetsView';
import { competenciaMesAno, EChart, trendOption } from '../charts/LazyEChart';
import { KpiCard } from './KpiCard';
import { RankingBar } from './RankingBar';

interface DynamicWidgetGridProps {
  widgets: ResolvedPainelWidget[];
  loading?: boolean;
  className?: string;
  testId?: string;
}

export function DynamicWidgetGrid({
  widgets,
  loading,
  className = 'painel-dynamic-grid',
  testId = 'dynamic-widget-grid',
}: DynamicWidgetGridProps) {
  const sorted = [...widgets].sort((a, b) => a.ordem - b.ordem || a.slug.localeCompare(b.slug));
  const { cards, linhas, rankings } = splitPainelWidgetsByTipo(sorted);

  return (
    <div className={className} data-testid={testId}>
      {loading ? <p className="painel-state-inline">Atualizando indicadores dinâmicos…</p> : null}

      {cards.length ? (
        <div className="foco-cards-grid">
          {cards.map((widget) => (
            <KpiCard key={widget.slug} kpi={mapWidgetToKpi(widget)} />
          ))}
        </div>
      ) : null}

      {linhas.map((widget) => {
        const series = mapWidgetToTrendSeries(widget);
        return (
          <section key={widget.slug} className="card painel-trend-card foco-linha">
            <div className="painel-section-head">
              <h3>{widget.titulo}</h3>
              <span className="mono painel-section-meta">
                {series[0] ? competenciaMesAno(series[0].competencia) : '—'} —{' '}
                {series[series.length - 1]
                  ? competenciaMesAno(series[series.length - 1].competencia)
                  : '—'}
              </span>
            </div>
            <EChart option={trendOption(series)} height={200} />
          </section>
        );
      })}

      {rankings.length ? (
        <div className="foco-rankings-grid">
          {rankings.map((widget) => (
            <section key={widget.slug} className="card painel-ranking-card">
              <h3>{widget.titulo}</h3>
              <div className="ranking-list">
                {mapWidgetToRanking(widget).map((row) => (
                  <RankingBar key={row.nome} row={row} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
