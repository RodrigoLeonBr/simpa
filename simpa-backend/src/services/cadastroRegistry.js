const ENTITIES = {
  equipes: {
    table: 'equipes',
    label: 'Equipe',
    listSql: `
      SELECT e.id, e.codigo, e.nome, e.tipo, e.estabelecimento_id,
             e.status, e.criado_em,
             est.nome AS unidade_nome,
             est.nome AS estabelecimento_nome,
             est.codigo_externo AS estabelecimento_codigo
      FROM equipes e
      LEFT JOIN estabelecimentos est ON est.id = e.estabelecimento_id
      WHERE e.status != 'inativo'
      {{FILTER_ESTABELECIMENTO}}
      ORDER BY e.nome`,
    listFilterEstabelecimento: true,
    createFields: ['codigo', 'nome', 'tipo', 'estabelecimento_id'],
    updateFields: ['nome', 'tipo', 'estabelecimento_id', 'status'],
    requiredCreate: ['codigo', 'nome', 'estabelecimento_id'],
    validateEstabelecimentoFk: true,
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
