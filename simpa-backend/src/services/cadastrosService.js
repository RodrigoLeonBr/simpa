const { query } = require('./db');
const { ENTITIES } = require('./cadastroRegistry');

function validateRequired(body, fields) {
  const missing = fields.filter((field) => {
    const value = body[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length) {
    return {
      ok: false,
      error: `${missing.join(', ')} ${missing.length === 1 ? 'é obrigatório' : 'são obrigatórios'}`,
    };
  }

  return { ok: true };
}

function pickFields(body, fields) {
  const out = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      out[field] = body[field];
    }
  }
  return out;
}

function buildInsert(table, fields, values) {
  const cols = fields.join(', ');
  const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ');
  return {
    sql: `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
    params: values,
  };
}

function buildUpdate(table, fields, values, id) {
  const sets = fields.map((field, i) => `${field}=$${i + 1}`).join(', ');
  return {
    sql: `UPDATE ${table} SET ${sets} WHERE id=$${fields.length + 1} RETURNING *`,
    params: [...values, id],
  };
}

async function listEntity(key, queryParams = {}) {
  const config = ENTITIES[key];
  if (!config) {
    const error = new Error('Recurso de cadastro inválido');
    error.status = 404;
    throw error;
  }

  let sql = config.listSql;
  const params = [];

  if (config.listFilterUnidade && queryParams.unidade_id) {
    params.push(queryParams.unidade_id);
    sql = sql.replace(
      '{{FILTER_UNIDADE}}',
      `AND e.unidade_id = $${params.length}`
    );
  } else {
    sql = sql.replace('{{FILTER_UNIDADE}}', '');
  }

  const { rows } = await query(sql, params);
  return rows;
}

async function createEntity(key, body) {
  const config = ENTITIES[key];
  const validation = validateRequired(body, config.requiredCreate);
  if (!validation.ok) {
    const error = new Error(validation.error);
    error.status = 400;
    throw error;
  }

  const data = pickFields(body, config.createFields);
  const fields = Object.keys(data);
  const { sql, params } = buildInsert(config.table, fields, fields.map((f) => data[f] ?? null));
  const { rows } = await query(sql, params);
  return rows[0];
}

async function updateEntity(key, id, body) {
  const config = ENTITIES[key];
  const data = pickFields(body, config.updateFields);

  if (Object.keys(data).length === 0) {
    const error = new Error('Nenhum campo para atualizar');
    error.status = 400;
    throw error;
  }

  if (data.status === undefined) {
    data.status = 'ativo';
  }

  const fields = Object.keys(data);
  const { sql, params } = buildUpdate(
    config.table,
    fields,
    fields.map((f) => data[f] ?? null),
    id
  );
  const { rows } = await query(sql, params);

  if (!rows.length) {
    const error = new Error(`${config.label} não encontrada`);
    error.status = 404;
    throw error;
  }

  return rows[0];
}

async function inactivateEntity(key, id) {
  const config = ENTITIES[key];
  const { rows } = await query(
    `UPDATE ${config.table} SET status='inativo' WHERE id=$1 RETURNING id`,
    [id]
  );

  if (!rows.length) {
    const error = new Error(`${config.label} não encontrada`);
    error.status = 404;
    throw error;
  }

  return { inativado: true, id: parseInt(id, 10) };
}

module.exports = {
  validateRequired,
  listEntity,
  createEntity,
  updateEntity,
  inactivateEntity,
  pickFields,
};
