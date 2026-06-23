export interface FaixaEtaria {
  faixa: string;
  masculino: number;
  feminino: number;
  indeterminado?: number;
  nao_informado?: number;
}

export interface CondicaoSaude {
  sim: number;
  nao: number;
  nao_informado: number;
}

export type CondicoesSaude = Record<string, CondicaoSaude>;

export type RacaCor = Record<string, number>;

export interface UnidadePopulacao {
  estabelecimento_id: number;
  estabelecimento_nome: string;
  cidadaos_ativos: number;
  saidas: number;
  importado_em: string;
}

export interface PopulacaoResponse {
  competencia: string;
  total_cidadaos_ativos: number;
  total_saidas: number;
  por_unidade: UnidadePopulacao[];
  faixa_etaria: FaixaEtaria[];
  condicoes_saude: CondicoesSaude;
  raca_cor: RacaCor;
}

export interface CompetenciaEntry {
  competencia: string;
  unidades_count: number;
  total_cidadaos_ativos: number;
}
