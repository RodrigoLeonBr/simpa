import type { ContratoDashboard, Unidade } from '../../types/contrato';
import { buildPainelKpis, buildTrendSeries } from '../../utils/dashboardView';
import { EChart, heroTrendOption, trendOption } from '../../components/charts/LazyEChart';
import { KpiCard } from '../../components/painel/KpiCard';
import { RankingBar } from '../../components/painel/RankingBar';
import { QualityBars } from '../../components/painel/QualityBars';
import { usePainelLayout } from '../../hooks/usePainelLayout';
import {
  mapWidgetToKpi,
  mapWidgetToRanking,
  mapWidgetToTrendSeries,
  splitPainelWidgetsByTipo,
} from '../../utils/painelWidgetsView';

interface LayoutBProps {
  data: ContratoDashboard;
  unidades: Unidade[];
}

export function LayoutB({ data, unidades }: LayoutBProps) {
  void unidades;
  const { layout, loading } = usePainelLayout('B');
  const widgets = layout?.widgets ?? [];

  if (widgets.length) {
    return <FocoDynamic widgets={widgets} loading={loading} />;
  }

  return <FocoConsolidado data={data} />;
}

function FocoDynamic({
  widgets,
  loading,
}: {
  widgets: NonNullable<ReturnType<typeof usePainelLayout>['layout']>['widgets'];
  loading: boolean;
}) {
  const sorted = [...widgets].sort((a, b) => a.ordem - b.ordem || a.slug.localeCompare(b.slug));
  const { cards, linhas, rankings } = splitPainelWidgetsByTipo(sorted);

  return (
    <div className="painel-layout-b" data-testid="layout-b">
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
                {series[0]?.competencia.slice(5) ?? '—'} — {series[series.length - 1]?.competencia.slice(5) ?? '—'}
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

function FocoConsolidado({ data }: { data: ContratoDashboard }) {
  const kpis = buildPainelKpis(data);
  const hero = kpis[0];
  const secondary = kpis.slice(3, 6);
  const trend = buildTrendSeries(data).map((point) => point.atendimentos);
  const cobertura = kpis[1];
  const equipes = kpis[2];
  const metas = kpis[3];

  return (
    <div className="painel-layout-b" data-testid="layout-b">
      <div className="layout-b-grid">
        <div className="layout-b-main">
          <section className="painel-hero-card">
            <div className="painel-hero-copy">
              <div className="painel-hero-kicker">
                Atendimentos individuais · {data.competencia}
              </div>
              <div className="painel-hero-value mono">{hero?.value ?? '—'}</div>
              <div className="painel-hero-delta">{hero?.delta.label ?? '—'}</div>
              <div className="painel-hero-stats">
                <div>
                  <div className="painel-hero-stat-label">Cobertura APS</div>
                  <div className="mono painel-hero-stat-value">{cobertura?.value ?? '—'}</div>
                </div>
                <div>
                  <div className="painel-hero-stat-label">Equipes ativas</div>
                  <div className="mono painel-hero-stat-value">{equipes?.value ?? '—'}</div>
                </div>
                <div>
                  <div className="painel-hero-stat-label">Metas atingidas</div>
                  <div className="mono painel-hero-stat-value">{metas?.value ?? '—'}</div>
                </div>
              </div>
            </div>
            <EChart option={heroTrendOption(trend)} height={180} />
          </section>

          <div className="kpi-grid-3">
            {secondary.map((kpi) => (
              <KpiCard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </div>

        <section className="card layout-b-side">
          <h3>Metas · Componente Qualidade</h3>
          <div className="quality-bar-list">
            <QualityBars data={data} />
          </div>
        </section>
      </div>
    </div>
  );
}
