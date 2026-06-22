import { useMemo } from 'react';
import { EChart, situacaoTrendOption } from '../../components/charts/LazyEChart';
import { useApp } from '../../contexts/AppContext';
import { useDashboard } from '../../hooks/useDashboard';
import { useFilters } from '../../hooks/useFilters';
import { buildPainelKpis, buildTrendSeries, type PainelKpi } from '../../utils/dashboardView';
import { SituacaoQualityBars } from './SituacaoQualityBars';

function formatLiveTimestamp(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}

function deltaClass(direction: PainelKpi['delta']['direction']): string {
  if (direction === 'up') return 'situacao-kpi-delta-up';
  if (direction === 'down') return 'situacao-kpi-delta-down';
  return 'situacao-kpi-delta-flat';
}

export function SituacaoOverlay() {
  const { closeSituacao } = useApp();
  const { competencia } = useFilters();
  const { data, loading, error } = useDashboard();
  const liveLabel = useMemo(() => formatLiveTimestamp(new Date()), []);

  const kpis = data ? buildPainelKpis(data).slice(0, 4) : [];
  const trend = data ? buildTrendSeries(data) : [];
  const trendRange =
    trend.length > 0
      ? `${trend[0]!.competencia.slice(5)} — ${trend[trend.length - 1]!.competencia.slice(5)}`
      : '—';

  return (
    <div
      className="situacao-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Sala de Situação"
      data-testid="situacao-overlay"
    >
      <header className="situacao-header">
        <div className="situacao-header-brand">
          <div className="situacao-logo">S</div>
          <div>
            <div className="situacao-title">SALA DE SITUAÇÃO · SIMPA</div>
            <div className="situacao-subtitle mono">
              Atenção Primária à Saúde · Americana/SP · Competência {competencia}
            </div>
          </div>
        </div>

        <div className="situacao-header-actions">
          <div className="situacao-live mono">
            <div className="situacao-live-label">ATUALIZADO</div>
            <div className="situacao-live-value">● ao vivo · {liveLabel}</div>
          </div>
          <button type="button" className="situacao-exit-btn" onClick={closeSituacao}>
            ↩ Sair do telão
          </button>
        </div>
      </header>

      {loading ? (
        <p className="situacao-status">Carregando dados…</p>
      ) : error ? (
        <p className="situacao-status situacao-status-error">{error}</p>
      ) : data ? (
        <>
          <div className="situacao-kpi-grid" data-testid="situacao-kpi-grid">
            {kpis.map((kpi) => (
              <article key={kpi.id} className="situacao-kpi-card">
                <div className="situacao-kpi-label">{kpi.label}</div>
                <div className="situacao-kpi-value mono">{kpi.value}</div>
                <div className={`situacao-kpi-delta ${deltaClass(kpi.delta.direction)}`}>{kpi.delta.label}</div>
              </article>
            ))}
          </div>

          <div className="situacao-charts-grid">
            <section className="situacao-chart-card">
              <div className="situacao-chart-head">
                <h3>Atendimentos individuais · 12 competências</h3>
                <span className="mono situacao-chart-meta">{trendRange}</span>
              </div>
              <EChart option={situacaoTrendOption(trend)} height="100%" testId="situacao-trend-chart" />
            </section>

            <section className="situacao-chart-card">
              <h3 className="situacao-quality-title">Componente Qualidade APS</h3>
              <SituacaoQualityBars data={data} />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default SituacaoOverlay;
