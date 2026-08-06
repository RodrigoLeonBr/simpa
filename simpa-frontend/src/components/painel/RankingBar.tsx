import type { RankingRow } from '../../utils/dashboardView';

export function RankingBar({ row }: { row: RankingRow }) {
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
