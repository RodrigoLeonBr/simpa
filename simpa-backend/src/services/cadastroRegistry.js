const ENTITIES = {
  unidades: {
    table: 'unidades_saude',
    label: 'Unidade',
    listSql: `
      SELECT id, codigo, nome, tipo, cnes, status, criado_em
      FROM unidades_saude
      WHERE status != 'inativo'
      ORDER BY nome`,
    createFields: ['codigo', 'nome', 'tipo', 'cnes'],
    updateFields: ['nome', 'tipo', 'cnes', 'status'],
    requiredCreate: ['codigo', 'nome'],
  },
  equipes: {
    table: 'equipes',
    label: 'Equipe',
    listSql: `
      SELECT e.id, e.codigo, e.nome, e.tipo, e.unidade_id, e.status, e.criado_em,
             u.nome AS unidade_nome
      FROM equipes e
      LEFT JOIN unidades_saude u ON u.id = e.unidade_id
      WHERE e.status != 'inativo'
      {{FILTER_UNIDADE}}
      ORDER BY e.nome`,
    listFilterUnidade: true,
    createFields: ['codigo', 'nome', 'tipo', 'unidade_id'],
    updateFields: ['nome', 'tipo', 'unidade_id', 'status'],
    requiredCreate: ['codigo', 'nome'],
  },
  procedimentos: {
    table: 'procedimentos',
    label: 'Procedimento',
    listSql: `
      SELECT id, codigo_sigtap, descricao, tipo, tabela_referencia, valor_referencia, status, criado_em
      FROM procedimentos
      WHERE status != 'inativo'
      ORDER BY codigo_sigtap`,
    createFields: ['codigo_sigtap', 'descricao', 'tipo', 'tabela_referencia', 'valor_referencia'],
    updateFields: ['descricao', 'tipo', 'tabela_referencia', 'valor_referencia', 'status'],
    requiredCreate: ['codigo_sigtap', 'descricao'],
  },
  'prestadores-mac': {
    table: 'prestadores_mac',
    label: 'Prestador MAC',
    listSql: `
      SELECT id, nome, cnes, tipo_contrato, status, criado_em
      FROM prestadores_mac
      WHERE status != 'inativo'
      ORDER BY nome`,
    createFields: ['nome', 'cnes', 'tipo_contrato'],
    updateFields: ['nome', 'cnes', 'tipo_contrato', 'status'],
    requiredCreate: ['nome'],
  },
  hospitais: {
    table: 'hospitais',
    label: 'Hospital',
    listSql: `
      SELECT id, nome, cnes, tipo, num_leitos, status, criado_em
      FROM hospitais
      WHERE status != 'inativo'
      ORDER BY nome`,
    createFields: ['nome', 'cnes', 'tipo', 'num_leitos'],
    updateFields: ['nome', 'cnes', 'tipo', 'num_leitos', 'status'],
    requiredCreate: ['nome'],
  },
  emendas: {
    table: 'emendas_parlamentares',
    label: 'Emenda',
    listSql: `
      SELECT id, id_emenda, esfera, tipo, autor, objeto, valor_repassado, status, criado_em
      FROM emendas_parlamentares
      WHERE status != 'inativo'
      ORDER BY id_emenda`,
    createFields: ['id_emenda', 'esfera', 'tipo', 'autor', 'objeto', 'valor_repassado'],
    updateFields: ['esfera', 'tipo', 'autor', 'objeto', 'valor_repassado', 'status'],
    requiredCreate: ['id_emenda', 'esfera'],
  },
};

module.exports = { ENTITIES };
