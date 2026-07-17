const { query } = require('./db');
const { parsePaginationParams, paginatedQuery } = require('./queryUtils');

function mapProcedimentoRow(row) {
  return {
    id: row.id,
    codigo_sigtap: row.codigo_sigtap,
    descricao: row.descricao,
    tipo: row.tipo,
    pa_total: row.pa_total,
    rubrica: row.rubrica,
    pa_id: row.pa_id,
    financiamento: row.financiamento,
    fonte: row.fonte,
    status: row.status,
    sincronizado_em: row.sincronizado_em,
  };
}

async function listProcedimentos(queryParams = {}) {
  const { page, limit, offset } = parsePaginationParams(queryParams);
  const q = queryParams.q ? `%${queryParams.q}%` : null;
  const status = queryParams.status || 'ativo';

  const conditions = ['1=1'];
  const params = [];

  if (status !== 'all') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (q) {
    params.push(q);
    conditions.push(`(descricao ILIKE $${params.length} OR codigo_sigtap ILIKE $${params.length})`);
  }

  return paginatedQuery({
    table: 'procedimentos',
    select: 'SELECT id, codigo_sigtap, descricao, tipo, pa_total, rubrica, pa_id, financiamento, fonte, status, sincronizado_em',
    orderBy: 'codigo_sigtap',
    conditions,
    params,
    mapFn: mapProcedimentoRow,
    page,
    limit,
    offset,
  });
}

async function getProcedimentoById(id) {
  const { rows } = await query(
    `SELECT id, codigo_sigtap, descricao, tipo, pa_total, rubrica, pa_id,
            financiamento, fonte, status, sincronizado_em
     FROM procedimentos
     WHERE id = $1`,
    [id]
  );

  if (!rows.length) {
    const error = new Error('Procedimento não encontrado');
    error.status = 404;
    throw error;
  }

  return mapProcedimentoRow(rows[0]);
}

module.exports = {
  listProcedimentos,
  getProcedimentoById,
  mapProcedimentoRow,
};
