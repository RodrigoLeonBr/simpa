import { useMemo } from 'react';
import { ProgressBar } from '../../components/shared/ProgressBar';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useDashboard } from '../../hooks/useDashboard';
import { useFilters } from '../../hooks/useFilters';
import { buildMetasResumo, enrichIndicador } from '../../utils/indicadoresView';

export default function MetasPage() {
  const { competencia } = useFilters();
  const { data, loading, error } = useDashboard();
  const enriched = useMemo(
    () => (data?.indicadores_qualidade ?? []).map(enrichIndicador),
    [data?.indicadores_qualidade],
  );
  const resumo = useMemo(() => buildMetasResumo(data?.indicadores_qualidade ?? []), [data?.indicadores_qualidade]);

  if (loading) {
    return <div className="analytics-state">Carregando metas…</div>;
  }

  if (error || !data) {
    return <div className="analytics-state analytics-state-error">{error ?? 'Metas indisponíveis'}</div>;
  }

  return (
    <div className="analytics-page simpa-rise">
      <div className="analytics-header">
        <h2 className="analytics-title">Acompanhamento de Metas</h2>
        <p className="analytics-subtitle">
          Meta vs. executado vs. % de atingimento · null = não apurado (nunca tratado como zero)
        </p>
      </div>

      <div className="metas-summary-grid">
        {resumo.map((card) => (
          <article key={card.label} className="card metas-summary-card">
            <div className="metas-summary-label">{card.label}</div>
            <div className="mono metas-summary-value" style={{ color: card.color }}>
              {card.value}
            </div>
            <div className="metas-summary-sub">{card.sub}</div>
          </article>
        ))}
      </div>

      <section className="card metas-table-card">
        <div className="metas-table-head">
          <h3>Metas por indicador · {competencia}</h3>
          <div className="metas-legend">
            <span className="metas-legend-dot metas-legend-green" />
            atingida
            <span className="metas-legend-dot metas-legend-amber" />
            próxima
            <span className="metas-legend-dot metas-legend-red" />
            abaixo
          </div>
        </div>

        <div className="metas-table-body">
          {enriched.map((item) => (
            <div key={item.indicador.cod} className="metas-table-row">
              <div className="metas-table-indicator">
                <div className="metas-table-name">
                  <span className="mono" style={{ color: item.status.color }}>
                    {item.indicador.cod}
                  </span>{' '}
                  {item.indicador.nomeCurto}
                </div>
                <div className="mono metas-table-origin">{item.origem}</div>
              </div>

              <ProgressBar
                execWidthPct={item.execWidthPct}
                metaWidthPct={item.metaWidthPct}
                color={item.status.color}
                execLabel={`executado ${item.execText}`}
                metaLabel={`meta ${item.metaText}`}
              />

              <div className="metas-table-status">
                <div className="mono metas-table-ating" style={{ color: item.status.color }}>
                  {item.atingText}
                </div>
                <StatusBadge status={item.status} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
