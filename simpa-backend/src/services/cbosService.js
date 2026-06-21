const { query } = require('./db');

const VALID_STATUS = ['ativo', 'inativo', 'all'];

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function mapCboRow(row) {
  return {
    id: row.id,
    codigo_cbo: row.codigo_cbo,
    descricao: row.descricao,
    status: row.status,
    sincronizado_em: row.sincronizado_em,
  };
}

async function listCbos(queryParams = {}) {
  const q = queryParams.q ? `%${queryParams.q}%` : null;
  const status = queryParams.status || 'ativo';
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), 200);
  const offset = (page - 1) * limit;

  if (!VALID_STATUS.includes(status)) {
    throw createHttpError('status inválido', 400);
  }

  const conditions = ['1=1'];
  const params = [];

  if (status !== 'all') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (q) {
    params.push(q);
    conditions.push(
      `(descricao ILIKE $${params.length} OR codigo_cbo ILIKE $${params.length})`
    );
  }

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM cbos_sia WHERE ${where}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT id, codigo_cbo, descricao, status, sincronizado_em
     FROM cbos_sia
     WHERE ${where}
     ORDER BY codigo_cbo
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    data: rows.map(mapCboRow),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

module.exports = {
  listCbos,
  mapCboRow,
};
