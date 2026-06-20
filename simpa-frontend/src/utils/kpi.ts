export const EM_DASH = '—';

export function formatKpi(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return EM_DASH;
  }

  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) {
    return EM_DASH;
  }

  return `${new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value * 100)}%`;
}

export function isNullKpi(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined;
}

export type DeltaDirection = 'up' | 'down' | 'flat';

export interface KpiDelta {
  label: string;
  direction: DeltaDirection;
}

export function computeDelta(current: number | null, previous: number | null): KpiDelta {
  if (current === null || previous === null || previous === 0) {
    return { label: '—', direction: 'flat' };
  }

  const pct = ((current - previous) / previous) * 100;
  const formatted = `${pct > 0 ? '▲' : pct < 0 ? '▼' : '0'} ${Math.abs(pct).toFixed(1).replace('.', ',')}%`;

  if (pct > 0) return { label: formatted, direction: 'up' };
  if (pct < 0) return { label: formatted, direction: 'down' };
  return { label: '0 estável', direction: 'flat' };
}
