const { query } = require('./db');

/**
 * Pure. Coerces pg strings; computes denominador and cobertura_pct.
 * @param {Array} rows — each: {imuno_codigo, imuno_nome, grupo_id, grupo_nome, doses, pop_alvo, num_doses}
 */
function computeCobertura(rows) {
  return rows.map((r) => {
    const doses = Number(r.doses);
    const pop_alvo = Number(r.pop_alvo);
    const num_doses = Number(r.num_doses);
    const denominador = pop_alvo * num_doses;
    const cobertura_pct = denominador > 0 ? (doses / denominador) * 100 : null;
    return { imuno_codigo: r.imuno_codigo, imuno_nome: r.imuno_nome, grupo_id: r.grupo_id, grupo_nome: r.grupo_nome, doses, pop_alvo, num_doses, denominador, cobertura_pct };
  });
}

/**
 * Acumula doses Jan→competenciaAte dentro do ano, cruza com esquema/população.
 */
async function getCobertura({ ano, competenciaAte, grupoId = null, imunoCodigo = null }) {
  const inicio = `${ano}-01-01`;
  const { rows } = await query(
    `SELECT e.imuno_codigo,
            COALESCE(i.imuno_nome, e.imuno_codigo) AS imuno_nome,
            e.grupo_id,
            g.nome AS grupo_nome,
            e.num_doses,
            COALESCE(p.populacao, 0) AS pop_alvo,
            COALESCE(SUM(d.doses), 0) AS doses
       FROM vacina_esquema e
       JOIN vacina_grupos g ON g.id = e.grupo_id
       LEFT JOIN vacina_imunobiologicos i ON i.imuno_codigo = e.imuno_codigo
       LEFT JOIN vacina_populacao_alvo p ON p.grupo_id = e.grupo_id AND p.ano = $1
       LEFT JOIN vacina_faixa_grupo fg ON fg.grupo_id = e.grupo_id
       LEFT JOIN vacina_doses d
              ON d.imuno_codigo = e.imuno_codigo
             AND d.faixa_nies = fg.faixa_nies
             AND d.competencia BETWEEN $2 AND $3
      WHERE ($4::bigint IS NULL OR e.grupo_id = $4)
        AND ($5::text   IS NULL OR e.imuno_codigo = $5)
      GROUP BY e.imuno_codigo, i.imuno_nome, e.grupo_id, g.nome, e.num_doses, p.populacao
      ORDER BY g.nome, imuno_nome`,
    [ano, inicio, competenciaAte, grupoId, imunoCodigo]
  );
  return computeCobertura(rows);
}

module.exports = { computeCobertura, getCobertura };
