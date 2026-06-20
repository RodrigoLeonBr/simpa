import type { PainelKpi } from '../../utils/dashboardView';
import { EChart, sparklineOption } from '../charts/EChart';

interface KpiCardProps {
  kpi: PainelKpi;
  compact?: boolean;
}

function deltaClass(direction: PainelKpi['delta']['direction']): string {
  if (direction === 'up') return 'kpi-delta-up';
  if (direction === 'down') return 'kpi-delta-down';
  return 'kpi-delta-flat';
}

export function KpiCard({ kpi, compact = false }: KpiCardProps) {
  const sparkColor =
    kpi.delta.direction === 'up'
      ? 'var(--green)'
      : kpi.delta.direction === 'down'
        ? 'var(--red)'
        : 'var(--text-muted)';

  return (
    <article className={`kpi-card${compact ? ' kpi-card-compact' : ''}`}>
      <div className="kpi-card-head">
        <div className="kpi-card-label">{kpi.label}</div>
        <span className={`kpi-card-delta mono ${deltaClass(kpi.delta.direction)}`}>{kpi.delta.label}</span>
      </div>
      <div className="kpi-card-value mono">{kpi.value}</div>
      {kpi.isNull ? <span className="kpi-null-badge">Não apurado</span> : null}
      {!compact && kpi.sparkSeries.length > 1 ? (
        <EChart option={sparklineOption(kpi.sparkSeries, sparkColor)} height={26} />
      ) : null}
    </article>
  );
}
