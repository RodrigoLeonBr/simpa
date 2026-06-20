import type { MetaStatus } from '../../utils/indicadoresView';

interface StatusBadgeProps {
  status: MetaStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`status-badge status-badge-${status.tone} ${className}`.trim()}
      style={{ color: status.color, background: status.badgeBg }}
    >
      {status.label}
    </span>
  );
}
