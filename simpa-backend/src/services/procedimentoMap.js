/**
 * Shared e-SUS → SIGTAP resolve (TechSpec Core Interfaces / ADR-004).
 * Calls Postgres function resolve_mapped_procedures — single SQL artifact
 * also used by consolidate_dashboard.py.
 */
const { query } = require('./db');

/**
 * Normalize competencia to YYYY-MM-DD for date cast.
 * Accepts '2026-05' or '2026-05-01'.
 */
function normalizeCompetencia(competencia) {
  if (!competencia) {
    const err = new Error('competencia é obrigatória');
    err.status = 400;
    throw err;
  }
  const s = String(competencia).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const err = new Error('competencia inválida (use YYYY-MM ou YYYY-MM-DD)');
  err.status = 400;
  throw err;
}

/**
 * @param {string} competencia YYYY-MM or YYYY-MM-DD
 * @param {string} unidade exact esus_cargas.unidade
 * @param {string} equipe exact esus_cargas.equipe_nome
 * @returns {Promise<Array<{secao, descricao_esus, codigo_sigtap, descricao_sigtap, quantidade}>>}
 */
async function resolveMappedProcedures(competencia, unidade, equipe) {
  if (unidade == null || unidade === '') {
    const err = new Error('unidade é obrigatória');
    err.status = 400;
    throw err;
  }
  if (equipe == null || equipe === '') {
    const err = new Error('equipe é obrigatória');
    err.status = 400;
    throw err;
  }
  const compDate = normalizeCompetencia(competencia);
  const { rows } = await query(
    `SELECT secao, descricao_esus, codigo_sigtap, descricao_sigtap, quantidade
     FROM resolve_mapped_procedures($1::date, $2, $3)`,
    [compDate, unidade, equipe]
  );
  return rows;
}

module.exports = {
  normalizeCompetencia,
  resolveMappedProcedures,
};
