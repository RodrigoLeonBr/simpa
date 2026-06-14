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
  total_atendimentos_aps: number;
  total_procedimentos_ambulatoriais: number;
  total_participantes_coletivos: number;
  atendimentos_odonto: number;
}

export interface ContratoDashboard {
  plataforma: string;
  versao_schema: string;
  competencia: string;
  municipio: string;
  filtros_ativos: { unidade: string; equipe: string };
  kpis_gerais: KpisGerais;
  modulos: {
    atencao_primaria_esus: ModuloAPS;
    ambulatorial_sia: ModuloSIA;
    hospitalar_sihd: ModuloSIHD;
    financiamento_metas: {
      classificacao_geral: string;
      indicadores: IndicadorFinanciamento[];
    };
    elementos_futuros: Record<string, unknown>;
  };
  emendas_parlamentares: unknown[];
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
  cnes?: string | null;
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
