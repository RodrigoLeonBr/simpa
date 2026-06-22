import type { ContratoDashboard, Unidade } from '../../types/contrato';
import { buildPainelKpis, buildTrendSeries } from '../../utils/dashboardView';
import { EChart, heroTrendOption } from '../../components/charts/LazyEChart';
import { KpiCard } from '../../components/painel/KpiCard';
import { QualityBars } from '../../components/painel/QualityBars';

interface LayoutBProps {
  data: ContratoDashboard;
  unidades: Unidade[];
}

export function LayoutB({ data, unidades }: LayoutBProps) {
  void unidades;
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
