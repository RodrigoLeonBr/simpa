const { query } = require('./db');

/**
 * Canonicalize reference codes: truncate longer values (e.g. prd_cbo 8 chars)
 * or left-pad shorter codes to the target length.
 */
function canonicalCode(value, length = 6) {
  if (value == null || value === '') {
    return null;
  }
  const text = String(value).trim();
  if (!text) {
    return null;
  }
  if (text.length >= length) {
    return text.slice(0, length);
  }
  return text.padStart(length, '0');
}

/** Derive forma code from SIGTAP/procedure code (left 6 chars). */
function canonicalFormaFromSigtap(codigoSigtap) {
  return canonicalCode(codigoSigtap, 6);
}

/** Canonicalize CBO code to 6 characters. */
function canonicalCboCode(codigoCbo) {
  return canonicalCode(codigoCbo, 6);
}

const SQL_CANONICAL_FORMA_EXPR = 'LEFT(TRIM(sp.codigo_sigtap), 6)';
const SQL_CANONICAL_CBO_EXPR =
  "CASE WHEN LENGTH(TRIM(sp.cbo)) >= 6 THEN LEFT(TRIM(sp.cbo), 6) ELSE LPAD(TRIM(sp.cbo), 6, '0') END";

async function resolveFormaDescricao(codigoForma) {
  const code = canonicalFormaFromSigtap(codigoForma);
  if (!code) {
    return null;
  }
  const { rows } = await query(
    `SELECT descricao FROM formas_sia WHERE codigo_forma = $1 AND status = 'ativo' LIMIT 1`,
    [code]
  );
  return rows[0]?.descricao ?? null;
}

async function resolveCboDescricao(codigoCbo) {
  const code = canonicalCboCode(codigoCbo);
  if (!code) {
    return null;
  }
  const { rows } = await query(
    `SELECT descricao FROM cbos_sia WHERE codigo_cbo = $1 AND status = 'ativo' LIMIT 1`,
    [code]
  );
  return rows[0]?.descricao ?? null;
}

module.exports = {
  canonicalCode,
  canonicalFormaFromSigtap,
  canonicalCboCode,
  SQL_CANONICAL_FORMA_EXPR,
  SQL_CANONICAL_CBO_EXPR,
  resolveFormaDescricao,
  resolveCboDescricao,
};
