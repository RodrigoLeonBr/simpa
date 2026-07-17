const { query } = require('./db');

function parsePaginationParams(queryParams = {}) {
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

async function paginatedQuery({ table, select, orderBy, conditions, params, mapFn, page, limit, offset }) {
  const where = conditions.join(' AND ');
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM ${table} WHERE ${where}`, params);
  const total = countResult.rows[0].total;
  const dataParams = [...params, limit, offset];
  const { rows } = await query(
    `${select} FROM ${table} WHERE ${where} ORDER BY ${orderBy} LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
    dataParams
  );
  return {
    data: rows.map(mapFn),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

module.exports = { parsePaginationParams, paginatedQuery };
