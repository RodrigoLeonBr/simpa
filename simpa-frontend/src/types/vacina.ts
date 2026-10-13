export interface VacinaImportPreview {
  competencia: string;
  doses_total: number;
  linhas: number;
  faixas_nao_mapeadas: string[];
}

export interface CoberturaRow {
  imuno_codigo: string;
  imuno_nome: string;
  grupo_id: number;
  grupo_nome: string;
  doses: number;
  pop_alvo: number;
  num_doses: number;
  denominador: number;
  cobertura_pct: number | null;
}

export interface VacinaGrupo {
  id: number;
  nome: string;
  slug: string;
  ordem: number;
  ativo: boolean;
}

export interface FaixaGrupo {
  faixa_nies: string;
  grupo_id: number | null;
  grupo_nome: string | null;
}

export interface PopulacaoAlvo {
  id: number;
  ano: number;
  grupo_id: number;
  grupo_nome: string;
  populacao: number;
}

export interface Esquema {
  id: number;
  imuno_codigo: string;
  imuno_nome: string;
  grupo_id: number;
  grupo_nome: string;
  num_doses: number;
}

export interface Imunobiologico {
  imuno_codigo: string;
  imuno_nome: string;
}

export interface VacinaDosesResumo {
  ano: number;
  mes: number | null;
  total_doses_mes: number;
  total_doses_ano: number;
  serie_mensal: { competencia: string; doses: number }[];
  por_vacina: { imuno_codigo: string; imuno_nome: string; doses: number }[];
  por_faixa: { faixa_nies: string; doses: number }[];
  por_unidade: { cnes_sala: string; sala_nome: string; doses: number }[];
  por_sistema: { sistema_origem: string | null; doses: number }[];
}

export interface VacinaDosesFiltros {
  anos: number[];
  salas: { cnes_sala: string; sala_nome: string }[];
}
