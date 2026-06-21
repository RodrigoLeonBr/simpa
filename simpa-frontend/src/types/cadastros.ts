export interface CadastroSyncCounts {
  inserted: number;
  updated: number;
  inactivated: number;
}

export interface CadastroSyncResult {
  status: 'ok' | 'parcial' | 'erro';
  estabelecimentos: CadastroSyncCounts;
  procedimentos: CadastroSyncCounts;
  sincronizado_em?: string;
  error?: string;
}

export interface CadastroSyncRecord {
  id: number;
  status: string;
  sincronizado_em: string;
  erro?: string | null;
  estabelecimentos: CadastroSyncCounts;
  procedimentos: CadastroSyncCounts;
  formas?: CadastroSyncCounts;
  cbos?: CadastroSyncCounts;
}

export type EstabelecimentoPerfil = 'APS' | 'MAC' | 'Hospitalar' | 'Misto' | 'Outro';

export type EnrichmentSlug = 'aps' | 'mac' | 'hospitalar' | 'misto' | 'outro';

export interface EnrichmentAps {
  notas_territorio?: string;
  cobertura_populacional?: string;
  vinculo_esus?: string;
  prioridades_planejamento?: string;
  notas?: string;
}

export interface EnrichmentMac {
  capacidades?: string[];
  relacionamento_referencia?: string;
  autorizacoes?: string;
  notas?: string;
}

export interface EnrichmentHospitalar {
  leitos?: Record<string, number>;
  especialidades?: string[];
  habilitacoes?: string[];
  capacidade_notas?: string;
  notas?: string;
}

export interface EnrichmentMisto {
  leitos?: Record<string, number>;
  capacidades_ambulatoriais?: string[];
  notas_mac?: string;
  notas?: string;
}

export interface EnrichmentOutro {
  notas?: string;
}

export type EnrichmentBySlug = {
  aps: EnrichmentAps;
  mac: EnrichmentMac;
  hospitalar: EnrichmentHospitalar;
  misto: EnrichmentMisto;
  outro: EnrichmentOutro;
};

export type EstabelecimentoEnrichment =
  | EnrichmentAps
  | EnrichmentMac
  | EnrichmentHospitalar
  | EnrichmentMisto
  | EnrichmentOutro;

/** @deprecated Use EnrichmentHospitalar on `enrichment` */
export type EstabelecimentoEnriquecimento = Pick<
  EnrichmentHospitalar,
  'leitos' | 'especialidades' | 'habilitacoes' | 'notas'
>;

export interface Estabelecimento {
  id: number;
  codigo_externo: string;
  nome: string;
  cnpj?: string | null;
  re_tipo?: string | null;
  tipouni?: string | null;
  perfil: EstabelecimentoPerfil;
  perfil_editado: boolean;
  area?: number | null;
  relatorio?: string | null;
  status: string;
  sincronizado_em?: string | null;
  enrichment?: EstabelecimentoEnrichment;
  /** @deprecated Use `enrichment` — legacy hospital JSONB shape */
  enriquecimento?: EstabelecimentoEnriquecimento;
}

export interface Procedimento {
  id: number;
  codigo_sigtap: string;
  descricao: string;
  tipo?: string | null;
  pa_total?: number | null;
  rubrica?: string | null;
  pa_id?: number | null;
  financiamento?: string | null;
  fonte?: string | null;
  status: string;
  sincronizado_em?: string | null;
}

export interface Forma {
  id: number;
  codigo_grupo: string;
  codigo_subgrupo: string;
  codigo_forma: string;
  descricao: string;
  status: string;
  sincronizado_em?: string | null;
}

export interface Cbo {
  id: number;
  codigo_cbo: string;
  descricao: string;
  status: string;
  sincronizado_em?: string | null;
}

export interface Equipe {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  estabelecimento_id?: number;
  unidade_id?: number;
  unidade_nome?: string;
  status: string;
}

export interface Emenda {
  id: number;
  id_emenda: string;
  esfera: string;
  tipo?: string | null;
  autor?: string | null;
  objeto?: string | null;
  valor_repassado?: number | null;
  status: string;
}

export type CadastroRecord = Equipe | Emenda;

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export type EstabelecimentosListResponse = PaginatedResponse<Estabelecimento>;
export type ProcedimentosListResponse = PaginatedResponse<Procedimento>;
export type FormasListResponse = PaginatedResponse<Forma>;
export type CbosListResponse = PaginatedResponse<Cbo>;

export type EstabelecimentoPerfilFilter = '' | EstabelecimentoPerfil;
