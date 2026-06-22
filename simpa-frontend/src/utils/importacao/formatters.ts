import type { PreviewCargaEnriquecida } from '../../types/importacao';
import type { ResolucaoDraft } from './types';

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

export function previewUnidadeLabel(item: PreviewCargaEnriquecida): string {
  return item.esus_unidade || item.unidade || '—';
}

export function previewEquipeLabel(item: PreviewCargaEnriquecida): string {
  return item.esus_equipe_nome || item.equipe_nome || '—';
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
  if (draft?.estabelecimento_codigo || draft?.estabelecimento_nome) {
    return [draft.estabelecimento_codigo, draft.estabelecimento_nome].filter(Boolean).join(' · ');
  }
  const suggestion = item.sugestoes_estabelecimento?.find((s) => s.id === estabelecimentoId);
  if (suggestion) {
    return `${suggestion.codigo_externo} · ${suggestion.nome}`;
  }
  return `ID ${estabelecimentoId}`;
}
