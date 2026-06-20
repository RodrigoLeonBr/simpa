import { EM_DASH } from '../../utils/kpi';

interface ProgressBarProps {
  execWidthPct: number;
  metaWidthPct?: number;
  color?: string;
  height?: number;
  showMetaMarker?: boolean;
  execLabel?: string;
  metaLabel?: string;
  compact?: boolean;
}

export function ProgressBar({
  execWidthPct,
  metaWidthPct = 0,
  color = 'var(--brand)',
  height = 14,
  showMetaMarker = true,
  execLabel,
  metaLabel,
  compact = false,
}: ProgressBarProps) {
  return (
    <div className={compact ? 'progress-bar-wrap compact' : 'progress-bar-wrap'}>
      <div className="progress-bar-track" style={{ height }}>
        <div className="progress-bar-fill" style={{ width: `${execWidthPct}%`, background: color }} />
        {showMetaMarker && metaWidthPct > 0 ? (
          <div className="progress-bar-meta" style={{ left: `${metaWidthPct}%` }} />
        ) : null}
      </div>
      {execLabel || metaLabel ? (
        <div className="progress-bar-labels mono">
          <span>{execLabel ?? `executado ${EM_DASH}`}</span>
          <span>{metaLabel ?? `meta ${EM_DASH}`}</span>
        </div>
      ) : null}
    </div>
  );
}
