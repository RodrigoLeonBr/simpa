const { parsePaginationParams, paginatedQuery } = require('./queryUtils');

const VALID_STATUS = ['ativo', 'inativo', 'all'];
const GRUPO_PATTERN = /^[0-9A-Za-z]{2}$/;
const SUBGRUPO_PATTERN = /^[0-9A-Za-z]{4}$/;

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function mapFormaRow(row) {
  return {
    id: row.id,
    codigo_grupo: row.codigo_grupo,
    codigo_subgrupo: row.codigo_subgrupo,
    codigo_forma: row.codigo_forma,
    descricao: row.descricao,
    status: row.status,
    sincronizado_em: row.sincronizado_em,
  };
}

async function listFormas(queryParams = {}) {
  const { page, limit, offset } = parsePaginationParams(queryParams);
  const q = queryParams.q ? `%${queryParams.q}%` : null;
  const status = queryParams.status || 'ativo';
  const grupo = queryParams.grupo ? String(queryParams.grupo).trim() : null;
  const subgrupo = queryParams.subgrupo ? String(queryParams.subgrupo).trim() : null;

  if (!VALID_STATUS.includes(status)) throw createHttpError('status inválido', 400);
  if (grupo && !GRUPO_PATTERN.test(grupo)) throw createHttpError('grupo inválido', 400);
  if (subgrupo && !SUBGRUPO_PATTERN.test(subgrupo)) throw createHttpError('subgrupo inválido', 400);

  const conditions = ['1=1'];
  const params = [];

  if (status !== 'all') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (grupo) {
    params.push(grupo);
    conditions.push(`codigo_grupo = $${params.length}`);
  }

  if (subgrupo) {
    params.push(subgrupo);
    conditions.push(`codigo_subgrupo = $${params.length}`);
  }

  if (q) {
    params.push(q);
    conditions.push(`(descricao ILIKE $${params.length} OR codigo_forma ILIKE $${params.length})`);
  }

  return paginatedQuery({
    table: 'formas_sia',
    select: 'SELECT id, codigo_grupo, codigo_subgrupo, codigo_forma, descricao, status, sincronizado_em',
    orderBy: 'codigo_forma',
    conditions,
    params,
    mapFn: mapFormaRow,
    page,
    limit,
    offset,
  });
}

module.exports = {
  listFormas,
  mapFormaRow,
};
