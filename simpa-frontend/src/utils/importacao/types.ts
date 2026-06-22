export interface ResolucaoDraft {
  estabelecimento_id: number | null;
  estabelecimento_codigo?: string | null;
  estabelecimento_nome?: string | null;
  equipe_id: number | null;
  salvar_mapeamento: boolean;
  confirmar_remocao_todas?: boolean;
}

export interface CargaStatus {
  label: string;
  tone: 'green' | 'amber' | 'blue';
  color: string;
  badgeBg: string;
}

export type { PreviewCargaEnriquecida as PreviewCargaItem } from '../../types/importacao';
