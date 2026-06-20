export type MapeamentoStatus = 'resolved' | 'pending' | 'blocked';

export interface EstabelecimentoSugestao {
  id: number;
  codigo_externo: string;
  nome: string;
  score: number;
}

export interface ConflitoTodas {
  exists: boolean;
  cargas_ids: number[];
  requires_confirm: boolean;
}

export interface PreviewCargaEnriquecida {
  nome: string;
  tipo_relatorio: string;
  competencia: string;
  esus_unidade: string;
  esus_equipe_nome: string;
  esus_equipe_codigo: string | null;
  mapeamento_status?: MapeamentoStatus;
  estabelecimento_id?: number;
  estabelecimento_codigo?: string;
  estabelecimento_nome?: string;
  equipe_id?: number;
  equipe_nome?: string;
  sugestoes_estabelecimento?: EstabelecimentoSugestao[];
  conflito_todas?: ConflitoTodas;
  ja_importado: boolean;
  error?: string;
  /** Campo legado opcional retornado por versões anteriores da API */
  unidade?: string;
}

export interface ResolucaoUpload {
  arquivo: string;
  estabelecimento_id: number;
  equipe_id: number;
  salvar_mapeamento: boolean;
  confirmar_remocao_todas?: boolean;
}

export interface UploadCargaResult {
  carga_id?: number;
  status?: string;
  arquivo?: string;
  arquivo_path?: string;
  hash_arquivo?: string;
  estabelecimento_id?: number;
  equipe_id?: number;
  error?: string;
  consolidacao?: { ok: boolean; error?: string; result?: unknown };
}

export interface CargaEsusComCadastro {
  id: number;
  tipo_relatorio: string;
  competencia: string;
  unidade: string;
  equipe_nome: string;
  arquivo_origem: string;
  arquivo_path?: string;
  hash_arquivo?: string;
  registros_identificados: number | null;
  registros_nao_identificados: number | null;
  importado_em: string;
  estabelecimento_id?: number | null;
  equipe_id?: number | null;
  estabelecimento_nome?: string | null;
  estabelecimento_codigo?: string | null;
  equipe_cadastro_nome?: string | null;
}

export interface EsusImportMapeamento {
  id: number;
  esus_unidade_label: string;
  esus_equipe_codigo?: string | null;
  esus_equipe_nome?: string | null;
  estabelecimento_id: number;
  equipe_id?: number | null;
  status: string;
  ultimo_uso_em?: string | null;
  estabelecimento_nome?: string;
  estabelecimento_codigo?: string;
  equipe_nome?: string;
}

export interface MapeamentosListResponse {
  data: EsusImportMapeamento[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface MapeamentoInput {
  esus_unidade_label: string;
  esus_equipe_codigo?: string | null;
  esus_equipe_nome?: string | null;
  estabelecimento_id: number;
  equipe_id?: number | null;
}

export interface MapeamentosQuery {
  q?: string;
  page?: number;
  limit?: number;
}
