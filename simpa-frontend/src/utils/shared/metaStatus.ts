import { EM_DASH, formatPercent } from '../kpi';

export type MetaStatusTone = 'green' | 'amber' | 'red' | 'null';

export interface MetaStatus {
  tone: MetaStatusTone;
  label: string;
  color: string;
  badgeBg: string;
}

export const META_COLORS = {
  green: '#1f8a5b',
  amber: '#c8862b',
  red: '#c0392b',
  dark: '#0f1b2d',
  brand: '#0b5fad',
  muted: '#8595a8',
} as const;

export function computeAtingimento(exec: number | null, meta: number | null): number | null {
  if (exec === null || meta === null || meta === 0) {
    return null;
  }
  return exec / meta;
}

export function resolveMetaStatus(exec: number | null, meta: number | null): MetaStatus {
  const ating = computeAtingimento(exec, meta);
  if (ating === null) {
    return {
      tone: 'null',
      label: 'Não apurado',
      color: META_COLORS.amber,
      badgeBg: '#fbf0dd',
    };
  }
  if (ating >= 1) {
    return { tone: 'green', label: 'atingida', color: META_COLORS.green, badgeBg: '#e6f3ec' };
  }
  if (ating >= 0.9) {
    return { tone: 'amber', label: 'próxima', color: META_COLORS.amber, badgeBg: '#fbf0dd' };
  }
  return { tone: 'red', label: 'abaixo', color: META_COLORS.red, badgeBg: '#fbe6e3' };
}

export function formatExecText(exec: number | null): string {
  if (exec === null) return EM_DASH;
  return formatPercent(exec, 1);
}

export function formatMetaText(meta: number | null): string {
  if (meta === null) return EM_DASH;
  return formatPercent(meta, 1);
}

export function formatAtingimentoText(exec: number | null, meta: number | null): string {
  const ating = computeAtingimento(exec, meta);
  if (ating === null) return EM_DASH;
  return `${Math.round(ating * 100)}%`;
}

export function execBarWidthPct(exec: number | null, scaleMax = 1): number {
  if (exec === null) return 0;
  return Math.min(100, (exec / scaleMax) * 100);
}

export function metaBarWidthPct(meta: number | null, scaleMax = 1): number {
  if (meta === null) return 0;
  return Math.min(100, (meta / scaleMax) * 100);
}
