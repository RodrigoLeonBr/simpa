export type CadastroEntityKey = 'equipes' | 'emendas';

export type FieldType = 'text' | 'number' | 'select';

export interface CadastroFieldDef {
  key: string;
  label: string;
  required?: boolean;
  type?: FieldType;
  mono?: boolean;
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
  columns: CadastroColumnDef[];
  fields: CadastroFieldDef[];
}

export interface CadastroGridItem {
  route: string;
  title: string;
  tableName: string;
  description: string;
  /** Link absoluto fora de /cadastros (ex.: Admin) */
  external?: boolean;
}

export const CADASTRO_GRID_ITEMS: CadastroGridItem[] = [
  {
    route: 'estabelecimentos',
    title: 'Estabelecimentos',
    tableName: 'estabelecimentos',
    description:
      'Espelho unificado de prestadores (APS, MAC, Hospitalar). Campos SIA somente leitura; enriquecimento para perfil hospitalar.',
  },
  {
    route: 'procedimentos',
    title: 'Procedimentos',
    tableName: 'procedimentos',
    description: 'Catálogo SIGTAP sincronizado do MySQL. Somente leitura — use o botão de sync para atualizar.',
  },
  {
    route: 'formas',
    title: 'Formas de Organização',
    tableName: 'formas_sia',
    description:
      'Forma de organização (grupo/subgrupo/forma) sincronizada do MySQL SIA. Somente leitura — use o botão de sync para atualizar.',
  },
  {
    route: 'cbos',
    title: 'CBOs',
    tableName: 'cbos_sia',
    description:
      'Classificação Brasileira de Ocupações sincronizada do MySQL SIA. Somente leitura — use o botão de sync para atualizar.',
  },
  {
    route: 'equipes',
    title: 'Equipes',
    tableName: 'equipes',
    description: 'Código e-SUS, nome, estabelecimento vinculado, tipo (ESF/EAP), status.',
  },
  {
    route: 'emendas',
    title: 'Emendas Parlamentares',
    tableName: 'emendas_parlamentares',
    description: 'id_emenda, esfera, tipo, autor, objeto, valor repassado, status.',
  },
  {
    route: 'indicadores-painel',
    title: 'Indicadores do Painel',
    tableName: 'painel_widgets',
    description:
      'Configuração dinâmica dos cards e gráficos do Painel APS (layout e métricas governadas).',
  },
  {
    route: '/admin',
    title: 'Indicadores e Metas',
    tableName: 'admin',
    description: 'Metas regulamentadas e indicadores de qualidade — gerenciados na Administração.',
    external: true,
  },
];

export const CADASTRO_ENTITIES: CadastroEntityConfig[] = [
  {
    key: 'equipes',
    route: 'equipes',
    title: 'Equipes',
    tableName: 'equipes',
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

export function cadastroGridTestId(route: string): string {
  if (route === '/admin') {
    return 'cadastro-card-indicadores-metas';
  }
  return `cadastro-card-${route.replace(/^\//, '')}`;
}
