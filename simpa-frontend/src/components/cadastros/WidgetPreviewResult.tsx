import type { ResolvedPainelWidget } from '../../types/painelWidgets';
import { EM_DASH } from '../../utils/kpi';

interface WidgetPreviewResultProps {
  result: ResolvedPainelWidget;
  testIdPrefix?: string;
  /** Limita linhas da série (drawer compacto). */
  seriesLimit?: number;
}

function formatDeltaDirection(direction: 'up' | 'down' | 'flat'): string {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  return '→';
}

export function WidgetPreviewResult({
  result,
  testIdPrefix = 'preview',
  seriesLimit,
}: WidgetPreviewResultProps) {
  const ranking = Array.isArray(result.ranking) ? result.ranking : [];
  const series = Array.isArray(result.series) ? result.series : [];
  const sparkSeries = Array.isArray(result.sparkSeries) ? result.sparkSeries : [];

  if (ranking.length > 0) {
    return (
      <div className="widget-preview-result-body" data-testid={`${testIdPrefix}-result-body`}>
        <p className="cadastro-field-hint">Ranking · {ranking.length} itens</p>
        <ul className="widget-preview-ranking" data-testid={`${testIdPrefix}-ranking`}>
          {ranking.map((row) => (
            <li key={row.label} className="widget-preview-ranking-row">
              <span>{row.label}</span>
              <span className="mono">{row.valueLabel || EM_DASH}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (series.length > 0) {
    const visibleSeries =
      seriesLimit != null && seriesLimit > 0 ? series.slice(-seriesLimit) : series;
    return (
      <div className="widget-preview-result-body" data-testid={`${testIdPrefix}-result-body`}>
        <p className="cadastro-field-hint">
          Série · {series.length} competência{series.length === 1 ? '' : 's'}
          {seriesLimit != null && series.length > visibleSeries.length
            ? ` (últimas ${visibleSeries.length})`
            : ''}
        </p>
        <ul className="widget-preview-series" data-testid={`${testIdPrefix}-series`}>
          {visibleSeries.map((point) => (
            <li key={point.competencia} className="widget-preview-series-row">
              <span className="mono">{point.competencia}</span>
              <span className="mono">{point.valor}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="widget-preview-result-body" data-testid={`${testIdPrefix}-result-body`}>
      <p
        className={`widget-preview-value mono${result.isNull ? ' widget-preview-value-null' : ''}`}
        data-testid={result.isNull ? `${testIdPrefix}-value-null` : `${testIdPrefix}-value`}
      >
        {result.valueLabel || EM_DASH}
      </p>
      {result.isNull ? <span className="kpi-null-badge">Não apurado</span> : null}
      {result.delta ? (
        <p className="widget-preview-delta" data-testid={`${testIdPrefix}-delta`}>
          {formatDeltaDirection(result.delta.direction)} {result.delta.label}
        </p>
      ) : null}
      {sparkSeries.length > 0 ? (
        <p className="cadastro-field-hint" data-testid={`${testIdPrefix}-spark`}>
          Sparkline: {sparkSeries.length} pontos · último {sparkSeries[sparkSeries.length - 1]}
        </p>
      ) : null}
    </div>
  );
}
