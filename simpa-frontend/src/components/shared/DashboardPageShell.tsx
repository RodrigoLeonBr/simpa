import type { ReactNode } from 'react';

export interface DashboardPageShellProps {
  loading: boolean;
  error?: string | null;
  loadingLabel?: string;
  children: ReactNode | (() => ReactNode);
  testId?: string;
}

function renderChildren(children: ReactNode | (() => ReactNode)): ReactNode {
  return typeof children === 'function' ? children() : children;
}

export function DashboardPageShell({
  loading,
  error = null,
  loadingLabel = 'Carregando…',
  children,
  testId,
}: DashboardPageShellProps) {
  if (loading) {
    return (
      <div className="analytics-state" data-testid={testId}>
        {loadingLabel}
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-state analytics-state-error" data-testid={testId}>
        {error}
      </div>
    );
  }

  return renderChildren(children);
}
