import type { ContratoDashboard } from '../../types/contrato';
import { formatPercent } from '../../utils/kpi';

export function QualityBars({ data }: { data: ContratoDashboard }) {
  return (data.indicadores_qualidade ?? []).map((item) => {
    const execPct = item.exec === null ? null : item.exec * 100;
    const metaPct = item.meta === null ? null : item.meta * 100;
    const width = execPct ?? 0;
    const metaLeft = metaPct ?? 0;
    const color = item.exec === null ? 'var(--amber)' : 'var(--brand)';

    return (
      <div key={item.cod} className="quality-bar-row">
        <div className="quality-bar-head">
          <span>
            <b className="mono" style={{ color }}>
              {item.cod}
            </b>{' '}
            {item.nomeCurto}
          </span>
          <span className="mono" style={{ color }}>
            {item.exec === null ? '—' : formatPercent(item.exec, 1)}
          </span>
        </div>
        <div className="quality-track">
          <div className="quality-fill" style={{ width: `${width}%`, background: color }} />
          {metaPct !== null ? (
            <div className="quality-meta-marker" style={{ left: `${metaLeft}%` }} />
          ) : null}
        </div>
      </div>
    );
  });
}
