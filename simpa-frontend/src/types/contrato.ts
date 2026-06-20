export interface DistribuicaoTurno {
  turno: string;
  atendimentos: number;
  procedimentos: number;
}

export interface TemaColetivo {
  tema: string;
  quantidade: number;
}

export interface FaixaEtaria {
  faixa: string;
  masculino: number;
  feminino: number;
}

export interface HistoricoMensal {
  competencia: string;
  atendimentos: number;
  procedimentos: number;
  meta: number | null;
}

export interface IndicadorFinanciamento {
  codigo: string;
  nome: string;
  equipe?: string;
  valor: number | null;
  meta: number | null;
}

export interface IndicadorQualidade {
  cod: string;
  nomeCurto: string;
  nome: string;
  categoria: string;
  meta: number | null;
  exec: number | null;
  num: string;
  den: string;
  fonte: string;
  periodicidade: string;
  porUnidade?: { unidade: string; exec: number | null }[];
  historico?: { competencia: string; exec: number | null }[];
}

export interface ModuloAPS {
  distribuicao_turnos: DistribuicaoTurno[];
  temas_coletivos: TemaColetivo[];
  distribuicao_faixa_etaria: FaixaEtaria[];
  historico_mensal: HistoricoMensal[];
}

export interface ModuloSIA {
  status_conexao: string;
  procedimentos_especializados: {
    codigo_sigtap: string;
    descricao: string;
    quantidade: number;
  }[];
}

export interface ModuloSIHD {
  status_importacao: string;
  internacoes_por_capitulo_cid: unknown[];
}

export interface KpisGerais {
  total_atendimentos_aps: number | null;
  total_procedimentos_ambulatoriais: number | null;
  total_participantes_coletivos: number | null;
  atendimentos_odonto: number | null;
}

export interface ContratoDashboard {
  plataforma: string;
  versao_schema: '3.1.0';
  competencia: string;
  municipio: string;
  filtros_ativos: { unidade: string; equipe: string };
  kpis_gerais: KpisGerais;
  modulos: {
    atencao_primaria_esus: ModuloAPS;
    ambulatorial_sia: ModuloSIA;
    hospitalar_sihd: ModuloSIHD;
    financiamento_metas: {
      classificacao_geral: string | null;
      indicadores: IndicadorFinanciamento[];
    };
    elementos_futuros: Record<string, unknown>;
  };
  emendas_parlamentares: unknown[];
  indicadores_qualidade: IndicadorQualidade[];
}

export interface CargaEsus {
  id: number;
  tipo_relatorio: string;
  competencia: string;
  unidade: string;
  equipe_nome: string;
  arquivo_origem: string;
  arquivo_path?: string;
  registros_identificados: number | null;
  registros_nao_identificados: number | null;
  importado_em: string;
}

export interface Unidade {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  status: string;
}

export interface Equipe {
  id: number;
  codigo: string;
  nome: string;
  tipo: string;
  unidade_id: number | null;
  unidade_nome?: string;
  status: string;
}
