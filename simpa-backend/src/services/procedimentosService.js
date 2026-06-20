const { query } = require('./db');

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
  const q = queryParams.q ? `%${queryParams.q}%` : null;
  const status = queryParams.status || 'ativo';
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), 200);
  const offset = (page - 1) * limit;

  const conditions = ['1=1'];
  const params = [];

  if (status !== 'all') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (q) {
    params.push(q);
    conditions.push(
      `(descricao ILIKE $${params.length} OR codigo_sigtap ILIKE $${params.length})`
    );
  }

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM procedimentos WHERE ${where}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT id, codigo_sigtap, descricao, tipo, pa_total, rubrica, pa_id,
            financiamento, fonte, status, sincronizado_em
     FROM procedimentos
     WHERE ${where}
     ORDER BY codigo_sigtap
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    data: rows.map(mapProcedimentoRow),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
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
