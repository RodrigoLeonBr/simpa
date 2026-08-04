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
 * Produção e-SUS importada da competência. Duas fontes no mesmo resultado:
 *   1. Procedimentos com de-para ativo (procedimentos_esus_sigtap).
 *   2. Blocos que já trazem o código SIGTAP na própria descrição (secao ILIKE
 *      '%SIGTAP%', ex. "Outros procedimentos (SIGTAP)"): código = 10 primeiros
 *      dígitos da descrição, sem de-para. Disjunto do (1) — de-para casa nomes
 *      amigáveis, esses blocos casam descrições já codificadas.
 * Agrega por unidade + SIGTAP. Zeros são descartados (sem produção real).
 */
async function exportProducao(competencia) {
  if (!competencia || !COMPETENCIA_RE.test(String(competencia))) {
    const err = new Error('competencia inválida — use YYYY-MM');
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    `SELECT * FROM (
       SELECT to_char(c.competencia, 'YYYY-MM')          AS competencia,
              est.codigo_externo                         AS cnes,
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
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
       HAVING SUM(COALESCE((r.valores->>'quantidade')::int, 0)) > 0

       UNION ALL

       SELECT to_char(c.competencia, 'YYYY-MM')          AS competencia,
              est.codigo_externo                         AS cnes,
              COALESCE(est.nome, c.unidade)              AS unidade,
              c.tipo_relatorio,
              r.secao                                    AS bloco,
              r.descricao                                AS descricao_esus,
              LEFT(regexp_replace(r.descricao, '\\D', '', 'g'), 10) AS codigo_sigtap,
              regexp_replace(r.descricao, '^[^A-Za-zÀ-ÿ]+', '')     AS descricao_sigtap,
              SUM(COALESCE((r.valores->>'quantidade')::int, 0)) AS quantidade
         FROM esus_indicadores_raw r
         JOIN esus_cargas c ON c.id = r.carga_id
         LEFT JOIN estabelecimentos est ON est.id = c.estabelecimento_id
        WHERE c.competencia = ($1 || '-01')::date
          AND r.secao ILIKE '%SIGTAP%'
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
       HAVING SUM(COALESCE((r.valores->>'quantidade')::int, 0)) > 0
     ) prod
      ORDER BY unidade, codigo_sigtap`,
    [competencia]
  );
  return rows;
}

module.exports = { listCompetencias, exportProducao };
