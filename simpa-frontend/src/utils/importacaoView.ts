import type { CargaEsus } from '../types/contrato';
import type {
  MapeamentoStatus,
  PreviewCargaEnriquecida,
  ResolucaoUpload,
} from '../types/importacao';

export type { PreviewCargaEnriquecida as PreviewCargaItem } from '../types/importacao';

export interface CargaStatus {
  label: string;
  tone: 'green' | 'amber' | 'blue';
  color: string;
  badgeBg: string;
}

const MAPEAMENTO_STATUS_LABELS: Record<MapeamentoStatus, string> = {
  resolved: 'Vinculado',
  pending: 'Pendente — selecione estabelecimento e equipe',
  blocked: 'Bloqueado — conflito com importação Todas',
};

export function buildMappingStatusLabel(status: MapeamentoStatus): string {
  return MAPEAMENTO_STATUS_LABELS[status] ?? 'Status desconhecido';
}

export function isPreviewCargaEnriquecida(value: unknown): value is PreviewCargaEnriquecida {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as PreviewCargaEnriquecida;
  if (typeof row.nome !== 'string') {
    return false;
  }
  if (row.mapeamento_status != null && !['resolved', 'pending', 'blocked'].includes(row.mapeamento_status)) {
    return false;
  }
  if (
    row.sugestoes_estabelecimento != null &&
    (!Array.isArray(row.sugestoes_estabelecimento) ||
      row.sugestoes_estabelecimento.some(
        (s) =>
          !s ||
          typeof s.id !== 'number' ||
          typeof s.codigo_externo !== 'string' ||
          typeof s.nome !== 'string',
      ))
  ) {
    return false;
  }
  return true;
}

export function parsePreviewResponse(rows: unknown): PreviewCargaEnriquecida[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.filter(isPreviewCargaEnriquecida);
}

export function hasEstabelecimentoSugestoes(item: PreviewCargaEnriquecida): boolean {
  return Array.isArray(item.sugestoes_estabelecimento) && item.sugestoes_estabelecimento.length > 0;
}

export function buildConflitoTodasMessage(item: PreviewCargaEnriquecida): string | null {
  if (!item.conflito_todas?.exists) {
    return null;
  }
  if (item.conflito_todas.requires_confirm) {
    return 'Existe importação "Todas" neste mês. Confirme a remoção para importar equipe específica.';
  }
  return 'Importação "Todas" bloqueada: já existem cargas de equipes específicas neste mês.';
}

export function previewUnidadeLabel(item: PreviewCargaEnriquecida): string {
  return item.esus_unidade || item.unidade || '—';
}

export function previewEquipeLabel(item: PreviewCargaEnriquecida): string {
  return item.esus_equipe_nome || item.equipe_nome || '—';
}

export const PLANNING_IMPORT_PERFIS = [
  'Administrador',
  'Gestor Secretaria',
  'Planejamento',
] as const;

export interface ResolucaoDraft {
  estabelecimento_id: number | null;
  equipe_id: number | null;
  salvar_mapeamento: boolean;
  confirmar_remocao_todas?: boolean;
}

export function canEditImportMappings(perfil: string | undefined): boolean {
  return PLANNING_IMPORT_PERFIS.includes(
    (perfil ?? '') as (typeof PLANNING_IMPORT_PERFIS)[number],
  );
}

export function defaultDraftFromPreview(item: PreviewCargaEnriquecida): ResolucaoDraft {
  return {
    estabelecimento_id: item.estabelecimento_id ?? null,
    equipe_id: item.equipe_id ?? null,
    salvar_mapeamento: false,
    confirmar_remocao_todas: false,
  };
}

export function hasPendingMapping(rows: PreviewCargaEnriquecida[]): boolean {
  return rows.some((row) => !row.error && row.mapeamento_status === 'pending');
}

export function isRowReadyForProcess(
  item: PreviewCargaEnriquecida,
  draft: ResolucaoDraft,
): boolean {
  if (item.error) {
    return false;
  }
  if (item.mapeamento_status === 'blocked') {
    if (item.conflito_todas?.requires_confirm) {
      const estabelecimentoId = draft.estabelecimento_id ?? item.estabelecimento_id ?? null;
      return estabelecimentoId != null && estabelecimentoId > 0;
    }
    return false;
  }
  if (item.mapeamento_status === 'pending') {
    const estabelecimentoId = draft.estabelecimento_id ?? item.estabelecimento_id ?? null;
    return estabelecimentoId != null && estabelecimentoId > 0;
  }
  const estabelecimentoId = draft.estabelecimento_id ?? item.estabelecimento_id ?? null;
  return estabelecimentoId != null && estabelecimentoId > 0;
}

export function canEnableProcess(
  rows: PreviewCargaEnriquecida[],
  drafts: Record<string, ResolucaoDraft>,
  isPlanningStaff: boolean,
): boolean {
  if (!isPlanningStaff) {
    return false;
  }
  const actionable = rows.filter((row) => !row.error);
  if (!actionable.length) {
    return false;
  }
  return actionable.every((row) =>
    isRowReadyForProcess(row, drafts[row.nome] ?? defaultDraftFromPreview(row)),
  );
}

export function buildResolucoesUpload(
  rows: PreviewCargaEnriquecida[],
  drafts: Record<string, ResolucaoDraft>,
): ResolucaoUpload[] {
  return rows
    .filter((row) => !row.error)
    .map((row) => {
      const draft = drafts[row.nome] ?? defaultDraftFromPreview(row);
      return {
        arquivo: row.nome,
        estabelecimento_id: draft.estabelecimento_id ?? row.estabelecimento_id ?? 0,
        equipe_id: draft.equipe_id ?? row.equipe_id ?? 0,
        salvar_mapeamento: draft.salvar_mapeamento,
        confirmar_remocao_todas: draft.confirmar_remocao_todas || undefined,
      };
    });
}

export function needsTodasConfirmation(
  rows: PreviewCargaEnriquecida[],
  drafts: Record<string, ResolucaoDraft>,
): PreviewCargaEnriquecida | null {
  for (const row of rows) {
    if (!row.conflito_todas?.requires_confirm) {
      continue;
    }
    const draft = drafts[row.nome] ?? defaultDraftFromPreview(row);
    if (!draft.confirmar_remocao_todas) {
      return row;
    }
  }
  return null;
}

export function formatCadastroTargetLabel(
  item: PreviewCargaEnriquecida,
  draft?: ResolucaoDraft,
): string | null {
  const estabelecimentoId = draft?.estabelecimento_id ?? item.estabelecimento_id;
  if (!estabelecimentoId) {
    return null;
  }
  if (
    item.estabelecimento_id === estabelecimentoId &&
    (item.estabelecimento_codigo || item.estabelecimento_nome)
  ) {
    return [item.estabelecimento_codigo, item.estabelecimento_nome].filter(Boolean).join(' · ');
  }
  const suggestion = item.sugestoes_estabelecimento?.find((s) => s.id === estabelecimentoId);
  if (suggestion) {
    return `${suggestion.codigo_externo} · ${suggestion.nome}`;
  }
  return `ID ${estabelecimentoId}`;
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
