export type CadastroEntityKey = 'equipes' | 'emendas' | 'procedimentos_esus_sigtap';

export type CadastroEntityMode = 'readonly' | 'crud' | 'custom';

export type FieldType = 'text' | 'number' | 'select';

export interface CadastroFieldDef {
  key: string;
  label: string;
  required?: boolean;
  type?: FieldType;
  mono?: boolean;
  /** Opções estáticas para type='select' (dropdowns de enum, não FK dinâmica) */
  options?: { value: string; label: string }[];
}

export interface CadastroColumnDef {
  key: string;
  label: string;
  mono?: boolean;
}

export interface CadastroEntityConfig {
  key: CadastroEntityKey;
  route: string;
  title: string;
  tableName: string;
  description: string;
  mode: CadastroEntityMode;
  columns: CadastroColumnDef[];
  fields: CadastroFieldDef[];
}

export interface CadastroGridItem {
  route: string;
  title: string;
  tableName: string;
  description: string;
  mode: CadastroEntityMode;
  /** Link absoluto fora de /cadastros (ex.: Admin) */
  external?: boolean;
}

export const CADASTRO_GRID_ITEMS: CadastroGridItem[] = [
  {
    route: 'estabelecimentos',
    title: 'Estabelecimentos',
    tableName: 'estabelecimentos',
    mode: 'custom',
    description:
      'Espelho unificado de prestadores (APS, MAC, Hospitalar). Campos SIA somente leitura; enriquecimento para perfil hospitalar.',
  },
  {
    route: 'procedimentos',
    title: 'Procedimentos',
    tableName: 'procedimentos',
    mode: 'readonly',
    description: 'Catálogo SIGTAP sincronizado do MySQL. Somente leitura — use o botão de sync para atualizar.',
  },
  {
    route: 'formas',
    title: 'Formas de Organização',
    tableName: 'formas_sia',
    mode: 'readonly',
    description:
      'Forma de organização (grupo/subgrupo/forma) sincronizada do MySQL SIA. Somente leitura — use o botão de sync para atualizar.',
  },
  {
    route: 'cbos',
    title: 'CBOs',
    tableName: 'cbos_sia',
    mode: 'readonly',
    description:
      'Classificação Brasileira de Ocupações sincronizada do MySQL SIA. Somente leitura — use o botão de sync para atualizar.',
  },
  {
    route: 'equipes',
    title: 'Equipes',
    tableName: 'equipes',
    mode: 'crud',
    description: 'Código e-SUS, nome, estabelecimento vinculado, tipo (ESF/EAP), status.',
  },
  {
    route: 'emendas',
    title: 'Emendas Parlamentares',
    tableName: 'emendas_parlamentares',
    mode: 'crud',
    description: 'id_emenda, esfera, tipo, autor, objeto, valor repassado, status.',
  },
  {
    route: 'metas-oci-par',
    title: 'Metas OCI / PAR',
    tableName: 'metas_oci_par',
    mode: 'custom',
    description:
      'Metas de produção OCI pactuadas no PAR (PMAE/PATE). Alimentam alcance meta no Painel MAC.',
  },
  {
    route: 'indicadores-painel',
    title: 'Indicadores do Painel',
    tableName: 'painel_widgets',
    mode: 'custom',
    description:
      'Configuração dinâmica dos cards e gráficos do Painel APS (layout e métricas governadas).',
  },
  {
    route: 'procedimentos-sigtap',
    title: 'Procedimentos e-SUS → SIGTAP',
    tableName: 'procedimentos_esus_sigtap',
    mode: 'crud',
    description:
      'De-para descrição de procedimento e-SUS → código SIGTAP, por relatório e bloco. Alimenta relatórios de produção por unidade.',
  },
  {
    route: '/admin',
    title: 'Indicadores e Metas',
    tableName: 'admin',
    mode: 'custom',
    description: 'Metas regulamentadas e indicadores de qualidade — gerenciados na Administração.',
    external: true,
  },
];

const TIPO_RELATORIO_OPTIONS = [
  { value: 'procedimentos_individualizados', label: 'Procedimentos individualizados' },
  { value: 'atendimento_odontologico', label: 'Atendimento odontológico' },
  { value: 'atendimento_domiciliar', label: 'Atendimento domiciliar' },
  { value: 'atividade_coletiva', label: 'Atividade coletiva' },
];

export const CADASTRO_ENTITIES: CadastroEntityConfig[] = [
  {
    key: 'procedimentos_esus_sigtap',
    route: 'procedimentos-sigtap',
    title: 'Procedimentos e-SUS → SIGTAP',
    tableName: 'procedimentos_esus_sigtap',
    mode: 'crud',
    description:
      'De-para descrição e-SUS → código SIGTAP. A descrição precisa ser idêntica à do relatório (é a chave do join).',
    columns: [
      { key: 'tipo_relatorio', label: 'Relatório' },
      { key: 'bloco', label: 'Bloco' },
      { key: 'descricao_esus', label: 'Descrição e-SUS' },
      { key: 'codigo_sigtap', label: 'SIGTAP', mono: true },
      { key: 'descricao_sigtap', label: 'Descrição SIGTAP' },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      {
        key: 'tipo_relatorio',
        label: 'Relatório',
        required: true,
        type: 'select',
        options: TIPO_RELATORIO_OPTIONS,
      },
      { key: 'bloco', label: 'Bloco', required: true },
      { key: 'descricao_esus', label: 'Descrição e-SUS (idêntica ao relatório)', required: true },
      { key: 'codigo_sigtap', label: 'Código SIGTAP (10 dígitos)', required: true, mono: true },
      { key: 'descricao_sigtap', label: 'Descrição SIGTAP' },
    ],
  },
  {
    key: 'equipes',
    route: 'equipes',
    title: 'Equipes',
    tableName: 'equipes',
    mode: 'crud',
    description: 'Equipes e-SUS vinculadas aos estabelecimentos.',
    columns: [
      { key: 'codigo', label: 'Código e-SUS', mono: true },
      { key: 'nome', label: 'Nome' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'unidade_nome', label: 'Estabelecimento' },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { key: 'codigo', label: 'Código e-SUS', required: true, mono: true },
      { key: 'nome', label: 'Nome', required: true },
      { key: 'tipo', label: 'Tipo' },
      { key: 'estabelecimento_id', label: 'Estabelecimento', required: true, type: 'select' },
    ],
  },
  {
    key: 'emendas',
    route: 'emendas',
    title: 'Emendas Parlamentares',
    tableName: 'emendas_parlamentares',
    mode: 'crud',
    description: 'Emendas vinculadas ao financiamento municipal.',
    columns: [
      { key: 'id_emenda', label: 'ID Emenda', mono: true },
      { key: 'esfera', label: 'Esfera' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'autor', label: 'Autor' },
      { key: 'valor_repassado', label: 'Valor', mono: true },
      { key: 'status', label: 'Status' },
    ],
    fields: [
      { key: 'id_emenda', label: 'ID Emenda', required: true, mono: true },
      { key: 'esfera', label: 'Esfera', required: true },
      { key: 'tipo', label: 'Tipo' },
      { key: 'autor', label: 'Autor' },
      { key: 'objeto', label: 'Objeto' },
      { key: 'valor_repassado', label: 'Valor repassado', type: 'number' },
    ],
  },
];

export function getCadastroEntity(route: string): CadastroEntityConfig | undefined {
  return CADASTRO_ENTITIES.find((entity) => entity.route === route);
}

export function getCadastroGridItem(route: string): CadastroGridItem | undefined {
  return CADASTRO_GRID_ITEMS.find((item) => item.route === route);
}

export function cadastroGridTestId(route: string): string {
  if (route === '/admin') {
    return 'cadastro-card-indicadores-metas';
  }
  return `cadastro-card-${route.replace(/^\//, '')}`;
}
