import type { CargaEsus } from '../types/contrato';

export interface CargaStatus {
  label: string;
  tone: 'green' | 'amber' | 'blue';
  color: string;
  badgeBg: string;
}

export interface PreviewCargaItem {
  nome: string;
  tipo_relatorio?: string;
  competencia?: string;
  unidade?: string;
  equipe_nome?: string;
  ja_importado?: boolean;
  error?: string;
}

export function isCsvFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.csv');
}

export function filterCsvFiles(files: File[]): File[] {
  return files.filter(isCsvFile);
}

export function buildCargaStatus(
  registrosIdentificados: number | null,
  registrosNaoIdentificados: number | null,
): CargaStatus {
  if (registrosIdentificados === null) {
    return {
      label: 'Processando',
      tone: 'blue',
      color: 'var(--brand)',
      badgeBg: 'var(--brand-bg)',
    };
  }

  if ((registrosNaoIdentificados ?? 0) > 0) {
    return {
      label: 'Parcial',
      tone: 'amber',
      color: 'var(--amber)',
      badgeBg: 'var(--amber-bg)',
    };
  }

  return {
    label: 'OK',
    tone: 'green',
    color: 'var(--green)',
    badgeBg: 'var(--green-bg)',
  };
}

export function countPendingCargas(cargas: CargaEsus[]): number {
  return cargas.filter((carga) => carga.registros_identificados === null).length;
}

export function formatTipoRelatorio(value: string): string {
  return value.replace(/_/g, ' ');
}

export function formatCompetencia(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 7);
}

export function formatImportDate(value: string): string {
  return new Date(value).toLocaleString('pt-BR');
}

export const CARGAS_UPDATED_EVENT = 'simpa:cargas-updated';

export function notifyCargasUpdated(): void {
  window.dispatchEvent(new Event(CARGAS_UPDATED_EVENT));
}
