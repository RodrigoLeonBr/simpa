import type { ContratoDashboard, Unidade } from '../../types/contrato';
import {
  buildPainelKpis,
  buildRanking,
  buildTrendSeries,
  type RankingRow,
} from '../../utils/dashboardView';
import { EChart, trendOption } from '../../components/charts/EChart';
import { KpiCard } from '../../components/painel/KpiCard';

interface LayoutAProps {
  data: ContratoDashboard;
  unidades: Unidade[];
}

export function LayoutA({ data, unidades }: LayoutAProps) {
  const kpis = buildPainelKpis(data);
  const trend = buildTrendSeries(data);
  const ranking = buildRanking(data, unidades);

  return (
    <div className="painel-layout-a" data-testid="layout-a">
      <div className="kpi-grid-3">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} />
        ))}
      </div>

      <div className="painel-split-grid">
        <section className="card painel-trend-card">
          <div className="painel-section-head">
            <h3>Atendimentos individuais</h3>
            <span className="mono painel-section-meta">
              {trend[0]?.competencia.slice(5) ?? '—'} — {trend[trend.length - 1]?.competencia.slice(5) ?? '—'}
            </span>
          </div>
          <EChart option={trendOption(trend)} height={200} testId="trend-chart" />
        </section>

        <section className="card painel-ranking-card">
          <h3>Produção por unidade · top 6</h3>
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
