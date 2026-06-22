import { useMemo, useState } from 'react';
import { EChart, indicadorHistoryOption } from '../../components/charts/LazyEChart';
import { DashboardPageShell } from '../../components/shared/DashboardPageShell';
import { ProgressBar } from '../../components/shared/ProgressBar';
import { useDashboard } from '../../hooks/useDashboard';
import {
  buildHistoricoSeries,
  buildUnitComparison,
  enrichIndicador,
} from '../../utils/indicadoresView';

export default function IndicadoresPage() {
  const { data, unidades, loading, error } = useDashboard();
  const [selectedCod, setSelectedCod] = useState<string | null>(null);

  const indicadores = data?.indicadores_qualidade ?? [];
  const enriched = useMemo(() => indicadores.map(enrichIndicador), [indicadores]);
  const activeCod = selectedCod ?? enriched[0]?.indicador.cod ?? null;
  const selected = enriched.find((item) => item.indicador.cod === activeCod) ?? enriched[0] ?? null;

  const historico = selected ? buildHistoricoSeries(selected.indicador) : [];
  const unitRows = selected
    ? buildUnitComparison(selected.indicador, unidades, data?.filtros_ativos.unidade)
    : [];

  const shellError = loading
    ? null
    : (error ?? (!data || !selected ? 'Indicadores indisponíveis' : null));

  return (
    <DashboardPageShell loading={loading} error={shellError} loadingLabel="Carregando indicadores…">
      {() => (
      <div className="analytics-page simpa-rise">
      <div className="analytics-header">
        <h2 className="analytics-title">Painel de Indicadores</h2>
        <p className="analytics-subtitle">
          Componente Qualidade APS · IGM SUS Paulista · drill-down por competência
        </p>
      </div>

      <div className="indicadores-grid">
        <aside className="indicadores-catalog card">
          <div className="indicadores-catalog-head">
            <span>Catálogo</span>
            <span className="mono indicadores-catalog-count">{enriched.length} ativos</span>
          </div>
          <div className="indicadores-catalog-list">
            {enriched.map((item) => {
              const isSelected = item.indicador.cod === selected.indicador.cod;
              return (
                <button
                  key={item.indicador.cod}
                  type="button"
                  className={`indicadores-catalog-item${isSelected ? ' selected' : ''}`}
                  onClick={() => setSelectedCod(item.indicador.cod)}
                >
                  <span className="mono indicadores-catalog-code" style={{ color: item.status.color }}>
                    {item.indicador.cod}
                  </span>
                  <span className="indicadores-catalog-name">{item.indicador.nomeCurto}</span>
                  <span className="mono indicadores-catalog-value" style={{ color: item.status.color }}>
                    {item.execText}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="indicadores-detail">
          <section className="card indicadores-detail-card">
            <div className="indicadores-detail-head">
              <div>
                <div className="indicadores-detail-badges">
                  <span
                    className="mono indicadores-code-badge"
                    style={{ color: selected.status.color, background: selected.status.badgeBg }}
                  >
                    {selected.indicador.cod}
                  </span>
                  <span className="mono indicadores-category">{selected.indicador.categoria}</span>
                </div>
                <h3 className="indicadores-detail-title">{selected.indicador.nome}</h3>
                <p className="indicadores-detail-desc">{selected.indicador.nome}</p>
              </div>
              <div className="indicadores-detail-metrics">
                <div className="indicadores-detail-label">Executado</div>
                <div className="mono indicadores-detail-value" style={{ color: selected.status.color }}>
                  {selected.execText}
                </div>
                <div className="mono indicadores-detail-meta">
                  meta {selected.metaText} · {selected.status.label}
                </div>
              </div>
            </div>

            <div className="indicadores-meta-chips">
              <div className="indicadores-chip mono">
                <span>Numerador</span> · {selected.indicador.num}
              </div>
              <div className="indicadores-chip mono">
                <span>Denominador</span> · {selected.indicador.den}
              </div>
              <div className="indicadores-chip mono">
                <span>Fonte</span> · {selected.indicador.fonte}
              </div>
              <div className="indicadores-chip mono">
                <span>Periodicidade</span> · {selected.indicador.periodicidade}
              </div>
            </div>
          </section>

          <section className="card indicadores-chart-card">
            <div className="indicadores-section-head">
              <h3>Série histórica · executado vs. meta</h3>
              <span className="mono indicadores-section-meta">12 competências</span>
            </div>
            {historico.length > 0 ? (
              <EChart
                option={indicadorHistoryOption(historico, selected.indicador.meta, selected.status.color)}
                height={200}
                testId="indicador-history-chart"
              />
            ) : (
              <p className="analytics-empty">Histórico não apurado para este indicador.</p>
            )}
          </section>

          <section className="card indicadores-units-card">
            <h3>Comparação entre unidades</h3>
            <div className="indicadores-units-list">
              {unitRows.map((row) => (
                <div key={row.nome} className="indicadores-unit-row">
                  <div className="indicadores-unit-name">{row.nome}</div>
                  <ProgressBar
                    execWidthPct={row.widthPct}
                    metaWidthPct={selected.metaWidthPct}
                    color={row.color}
                    height={18}
                  />
                  <div className="mono indicadores-unit-value" style={{ color: row.color }}>
                    {row.execText}
                  </div>
                </div>
              ))}
            </div>
            <p className="indicadores-meta-legend">
              <span className="indicadores-meta-line" /> linha tracejada = meta regulamentada ({selected.metaText})
            </p>
          </section>
        </div>
      </div>
      </div>
      )}
    </DashboardPageShell>
  );
}
