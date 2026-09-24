'use strict';

const { query } = require('./db');

/**
 * Aggregations over vacina_doses for the doses reports.
 * - serie_mensal: full calendar year (Jan..Dec) of `ano`.
 * - accumulated breakdowns: Jan..mes (or whole year when mes is null).
 * - cnesSala filters every slice to one unit when provided.
 */
async function getResumoDoses({ ano, mes = null, cnesSala = null }) {
  const inicioAno = `${ano}-01-01`;
  const fimAno = `${ano}-12-01`;
  const mesPad = mes ? String(mes).padStart(2, '0') : null;
  const fimAcum = mes ? `${ano}-${mesPad}-01` : fimAno;

  const range = 'competencia BETWEEN $1 AND $2 AND ($3::text IS NULL OR cnes_sala = $3)';
  const anoParams = [inicioAno, fimAno, cnesSala];
  const acumParams = [inicioAno, fimAcum, cnesSala];

  const [serie, vacina, faixa, unidade, sistema] = await Promise.all([
    query(
      `SELECT to_char(competencia, 'YYYY-MM') AS competencia, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY competencia ORDER BY competencia`,
      anoParams
    ),
    query(
      `SELECT imuno_codigo, MAX(imuno_nome) AS imuno_nome, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY imuno_codigo ORDER BY doses DESC`,
      acumParams
    ),
    query(
      `SELECT faixa_nies, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY faixa_nies ORDER BY doses DESC`,
      acumParams
    ),
    query(
      `SELECT cnes_sala, MAX(sala_nome) AS sala_nome, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY cnes_sala ORDER BY doses DESC`,
      acumParams
    ),
    query(
      `SELECT sistema_origem, COALESCE(SUM(doses), 0)::int AS doses
         FROM vacina_doses WHERE ${range}
        GROUP BY sistema_origem ORDER BY doses DESC`,
      acumParams
    ),
  ]);

  const serie_mensal = serie.rows.map((r) => ({ competencia: r.competencia, doses: Number(r.doses) }));
  const mesAlvo = fimAcum.slice(0, 7); // 'YYYY-MM'
  const total_doses_ano = serie_mensal
    .filter((r) => r.competencia <= mesAlvo)
    .reduce((sum, r) => sum + r.doses, 0);
  const total_doses_mes = mes
    ? (serie_mensal.find((r) => r.competencia === mesAlvo)?.doses ?? 0)
    : total_doses_ano;

  return {
    ano,
    mes,
    total_doses_mes,
    total_doses_ano,
    serie_mensal,
    por_vacina: vacina.rows.map((r) => ({ imuno_codigo: r.imuno_codigo, imuno_nome: r.imuno_nome, doses: Number(r.doses) })),
    por_faixa: faixa.rows.map((r) => ({ faixa_nies: r.faixa_nies, doses: Number(r.doses) })),
    por_unidade: unidade.rows.map((r) => ({ cnes_sala: r.cnes_sala, sala_nome: r.sala_nome, doses: Number(r.doses) })),
    por_sistema: sistema.rows.map((r) => ({ sistema_origem: r.sistema_origem, doses: Number(r.doses) })),
  };
}

/** Filter options for the report: available years and units (independent of active filters). */
async function getFiltros() {
  const [anos, salas] = await Promise.all([
    query(`SELECT DISTINCT EXTRACT(YEAR FROM competencia)::int AS ano FROM vacina_doses ORDER BY ano DESC`),
    query(`SELECT DISTINCT cnes_sala, sala_nome FROM vacina_doses ORDER BY sala_nome`),
  ]);
  return {
    anos: anos.rows.map((r) => r.ano),
    salas: salas.rows.map((r) => ({ cnes_sala: r.cnes_sala, sala_nome: r.sala_nome })),
  };
}

module.exports = { getResumoDoses, getFiltros };
