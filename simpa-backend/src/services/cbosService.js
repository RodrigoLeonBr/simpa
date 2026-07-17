const { parsePaginationParams, paginatedQuery } = require('./queryUtils');

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
  const { page, limit, offset } = parsePaginationParams(queryParams);
  const q = queryParams.q ? `%${queryParams.q}%` : null;
  const status = queryParams.status || 'ativo';

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
    conditions.push(`(descricao ILIKE $${params.length} OR codigo_cbo ILIKE $${params.length})`);
  }

  return paginatedQuery({
    table: 'cbos_sia',
    select: 'SELECT id, codigo_cbo, descricao, status, sincronizado_em',
    orderBy: 'codigo_cbo',
    conditions,
    params,
    mapFn: mapCboRow,
    page,
    limit,
    offset,
  });
}

module.exports = {
  listCbos,
  mapCboRow,
};
