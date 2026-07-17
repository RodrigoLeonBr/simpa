const { query } = require('./db');

const PERIODICIDADES = new Set(['mensal', 'quadrimestral', 'anual']);
const STATUS_ATIVO = 'ativo';

function parsePositiveInt(value, field) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    const err = new Error(`${field} inválido`);
    err.status = 400;
    throw err;
  }
  return parsed;
}

function parseCompetencia(value) {
  if (!value || typeof value !== 'string') {
    const err = new Error('competencia obrigatória (YYYY-MM)');
    err.status = 400;
    throw err;
  }
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    const err = new Error('competencia inválida — use YYYY-MM');
    err.status = 400;
    throw err;
  }
  return `${value}-01`;
}

function normalizePayload(body, { partial = false } = {}) {
  const payload = {};

  if (!partial || body.competencia !== undefined) {
    payload.competencia = parseCompetencia(body.competencia);
  }
  if (!partial || body.tipo_oci !== undefined) {
    const tipo = String(body.tipo_oci ?? '').trim();
    if (!tipo) {
      const err = new Error('tipo_oci obrigatório');
      err.status = 400;
      throw err;
    }
    payload.tipo_oci = tipo.slice(0, 60);
  }
  if (!partial || body.meta_quantidade !== undefined) {
    const qtd = Number.parseInt(String(body.meta_quantidade), 10);
    if (!Number.isFinite(qtd) || qtd < 0) {
      const err = new Error('meta_quantidade inválida');
      err.status = 400;
      throw err;
    }
    payload.meta_quantidade = qtd;
  }
  if (!partial || body.meta_valor !== undefined) {
    if (body.meta_valor == null || body.meta_valor === '') {
      payload.meta_valor = null;
    } else {
      const val = Number.parseFloat(String(body.meta_valor));
      if (!Number.isFinite(val) || val < 0) {
        const err = new Error('meta_valor inválida');
        err.status = 400;
        throw err;
      }
      payload.meta_valor = val;
    }
  }
  if (!partial || body.codigo_sigtap_prefix !== undefined) {
    const prefix = body.codigo_sigtap_prefix == null ? null : String(body.codigo_sigtap_prefix).trim();
    payload.codigo_sigtap_prefix = prefix || null;
  }
  if (!partial || body.periodicidade !== undefined) {
    const per = String(body.periodicidade ?? 'mensal').trim();
    if (!PERIODICIDADES.has(per)) {
      const err = new Error('periodicidade inválida');
      err.status = 400;
      throw err;
    }
    payload.periodicidade = per;
  }
  if (!partial || body.origem !== undefined) {
    payload.origem = String(body.origem ?? 'PAR-PMAE').trim().slice(0, 80) || 'PAR-PMAE';
  }
  if (!partial || body.estabelecimento_id !== undefined) {
    if (body.estabelecimento_id == null || body.estabelecimento_id === '') {
      payload.estabelecimento_id = null;
    } else {
      payload.estabelecimento_id = parsePositiveInt(body.estabelecimento_id, 'estabelecimento_id');
    }
  }

  return payload;
}

async function listMetasOciPar(filters = {}) {
  const conditions = ["m.status = 'ativo'"];
  const params = [];

  if (filters.competencia) {
    params.push(parseCompetencia(filters.competencia));
    conditions.push(`m.competencia = $${params.length}::date`);
  }
  if (filters.tipo_oci) {
    params.push(`%${String(filters.tipo_oci).trim()}%`);
    conditions.push(`m.tipo_oci ILIKE $${params.length}`);
  }

  const { rows } = await query(
    `SELECT m.id, m.competencia, m.tipo_oci, m.estabelecimento_id,
            est.nome AS estabelecimento_nome,
            m.meta_quantidade, m.meta_valor, m.codigo_sigtap_prefix,
            m.periodicidade, m.origem, m.status, m.criado_em, m.atualizado_em
     FROM metas_oci_par m
     LEFT JOIN estabelecimentos est ON est.id = m.estabelecimento_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.competencia DESC, m.tipo_oci ASC, m.estabelecimento_id NULLS FIRST`,
    params
  );

  return rows.map((row) => ({
    ...row,
    competencia: row.competencia instanceof Date
      ? row.competencia.toISOString().slice(0, 7)
      : String(row.competencia).slice(0, 7),
  }));
}

async function createMetaOciPar(body) {
  const payload = normalizePayload(body);
  const { rows } = await query(
    `INSERT INTO metas_oci_par (
       competencia, tipo_oci, estabelecimento_id, meta_quantidade, meta_valor,
       codigo_sigtap_prefix, periodicidade, origem, status, atualizado_em
     ) VALUES (
       $1::date, $2, $3, $4, $5, $6, $7, $8, 'ativo', now()
     )
     RETURNING id`,
    [
      payload.competencia,
      payload.tipo_oci,
      payload.estabelecimento_id ?? null,
      payload.meta_quantidade ?? 0,
      payload.meta_valor ?? null,
      payload.codigo_sigtap_prefix ?? null,
      payload.periodicidade ?? 'mensal',
      payload.origem ?? 'PAR-PMAE',
    ]
  );
  return getMetaOciParById(rows[0].id);
}

async function getMetaOciParById(id) {
  const metaId = parsePositiveInt(id, 'id');
  const { rows } = await query(
    `SELECT m.id, m.competencia, m.tipo_oci, m.estabelecimento_id,
            est.nome AS estabelecimento_nome,
            m.meta_quantidade, m.meta_valor, m.codigo_sigtap_prefix,
            m.periodicidade, m.origem, m.status, m.criado_em, m.atualizado_em
     FROM metas_oci_par m
     LEFT JOIN estabelecimentos est ON est.id = m.estabelecimento_id
     WHERE m.id = $1`,
    [metaId]
  );
  if (!rows.length) {
    const err = new Error('Meta OCI/PAR não encontrada');
    err.status = 404;
    throw err;
  }
  const row = rows[0];
  return {
    ...row,
    competencia: row.competencia instanceof Date
      ? row.competencia.toISOString().slice(0, 7)
      : String(row.competencia).slice(0, 7),
  };
}

async function updateMetaOciPar(id, body) {
  const metaId = parsePositiveInt(id, 'id');
  const payload = normalizePayload(body, { partial: true });
  const fields = Object.keys(payload);
  if (!fields.length) {
    return getMetaOciParById(metaId);
  }

  const sets = fields.map((field, idx) => {
    if (field === 'competencia') {
      return `competencia = $${idx + 2}::date`;
    }
    return `${field} = $${idx + 2}`;
  });

  const values = fields.map((field) => payload[field]);
  const { rowCount } = await query(
    `UPDATE metas_oci_par
     SET ${sets.join(', ')}, atualizado_em = now()
     WHERE id = $1 AND status = 'ativo'`,
    [metaId, ...values]
  );

  if (!rowCount) {
    const err = new Error('Meta OCI/PAR não encontrada');
    err.status = 404;
    throw err;
  }

  return getMetaOciParById(metaId);
}

async function inactivateMetaOciPar(id) {
  const metaId = parsePositiveInt(id, 'id');
  const { rowCount } = await query(
    `UPDATE metas_oci_par SET status = 'inativo', atualizado_em = now()
     WHERE id = $1 AND status = 'ativo'`,
    [metaId]
  );
  if (!rowCount) {
    const err = new Error('Meta OCI/PAR não encontrada');
    err.status = 404;
    throw err;
  }
  return { ok: true };
}

module.exports = {
  listMetasOciPar,
  createMetaOciPar,
  getMetaOciParById,
  updateMetaOciPar,
  inactivateMetaOciPar,
};
