import type { ContratoDashboard } from '../../types/contrato';
import { formatPercent } from '../../utils/kpi';

export function SituacaoQualityBars({ data }: { data: ContratoDashboard }) {
  return (
    <div className="situacao-quality-list">
      {data.indicadores_qualidade.map((item) => {
        const execPct = item.exec === null ? null : item.exec * 100;
        const metaPct = item.meta === null ? null : item.meta * 100;
        const width = execPct ?? 0;
        const metaLeft = metaPct ?? 0;
        const color = item.exec === null ? '#f59e0b' : '#3b9bff';

        return (
          <div key={item.cod} className="situacao-quality-row">
            <div className="situacao-quality-head">
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
            <div className="situacao-quality-track">
              <div className="situacao-quality-fill" style={{ width: `${width}%`, background: color }} />
              {metaPct !== null ? (
                <div className="situacao-quality-meta" style={{ left: `${metaLeft}%` }} />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
