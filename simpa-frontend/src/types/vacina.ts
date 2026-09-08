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
