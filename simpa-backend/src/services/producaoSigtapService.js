const { query } = require('./db');

const COMPETENCIA_RE = /^\d{4}-\d{2}$/;

/** Competências (YYYY-MM) que têm produção e-SUS importada, mais recente primeiro. */
async function listCompetencias() {
  const { rows } = await query(
    `SELECT to_char(competencia, 'YYYY-MM') AS competencia
       FROM esus_cargas
      GROUP BY competencia
      ORDER BY competencia DESC`
  );
  return rows.map((r) => r.competencia);
}

/**
 * Produção e-SUS importada da competência, filtrada aos procedimentos que
 * têm de-para ativo (procedimentos_esus_sigtap). Agrega por unidade + SIGTAP.
 * Zeros são descartados (sem produção real).
 */
async function exportProducao(competencia) {
  if (!competencia || !COMPETENCIA_RE.test(String(competencia))) {
    const err = new Error('competencia inválida — use YYYY-MM');
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    `SELECT to_char(c.competencia, 'YYYY-MM')          AS competencia,
            COALESCE(est.nome, c.unidade)              AS unidade,
            c.tipo_relatorio,
            m.bloco,
            r.descricao                                AS descricao_esus,
            m.codigo_sigtap,
            m.descricao_sigtap,
            SUM(COALESCE((r.valores->>'quantidade')::int, 0)) AS quantidade
       FROM esus_indicadores_raw r
       JOIN esus_cargas c ON c.id = r.carga_id
       JOIN procedimentos_esus_sigtap m
         ON m.tipo_relatorio = c.tipo_relatorio
        AND m.descricao_esus = r.descricao
       LEFT JOIN estabelecimentos est ON est.id = c.estabelecimento_id
      WHERE c.competencia = ($1 || '-01')::date
        AND m.status = 'ativo'
      GROUP BY 1, 2, 3, 4, 5, 6, 7
     HAVING SUM(COALESCE((r.valores->>'quantidade')::int, 0)) > 0
      ORDER BY unidade, m.codigo_sigtap`,
    [competencia]
  );
  return rows;
}

module.exports = { listCompetencias, exportProducao };
