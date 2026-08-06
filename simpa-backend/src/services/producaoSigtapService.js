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
 * Produção e-SUS importada da competência, chaveada por código SIGTAP.
 * Fonte única: a view v_esus_producao_sigtap (JOIN com procedimentos_esus_sigtap
 * — mapeamentos curados + blocos SIGTAP descobertos). Agrega por unidade +
 * SIGTAP; zeros descartados (sem produção real).
 */
async function exportProducao(competencia) {
  if (!competencia || !COMPETENCIA_RE.test(String(competencia))) {
    const err = new Error('competencia inválida — use YYYY-MM');
    err.status = 400;
    throw err;
  }

  const { rows } = await query(
    `SELECT to_char(vs.competencia, 'YYYY-MM')        AS competencia,
            est.codigo_externo                        AS cnes,
            COALESCE(est.nome, vs.unidade)            AS unidade,
            vs.tipo_relatorio,
            vs.bloco,
            vs.descricao_esus,
            vs.codigo_sigtap,
            vs.descricao_sigtap,
            SUM(vs.quantidade)                        AS quantidade
       FROM v_esus_producao_sigtap vs
       LEFT JOIN estabelecimentos est ON est.id = vs.estabelecimento_id
      WHERE vs.competencia = ($1 || '-01')::date
      GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
     HAVING SUM(vs.quantidade) > 0
      ORDER BY unidade, codigo_sigtap`,
    [competencia]
  );
  return rows;
}

/**
 * Varre blocos SIGTAP do e-SUS (secao ILIKE '%SIGTAP%') e faz UPSERT dos códigos
 * (10 dígitos iniciais da descrição) em procedimentos_esus_sigtap como
 * origem='descoberto'. Idempotente; ON CONFLICT preserva linhas curadas.
 * Chamada pós-importação para manter o de-para em dia com códigos novos.
 */
async function discoverEsusSigtapFromBlocks() {
  const result = await query(
    `INSERT INTO procedimentos_esus_sigtap
       (tipo_relatorio, bloco, descricao_esus, codigo_sigtap, descricao_sigtap, origem)
     SELECT DISTINCT
        c.tipo_relatorio,
        r.secao,
        r.descricao,
        substring(r.descricao from '^\\s*(\\d{10})'),
        btrim(regexp_replace(r.descricao, '^[^A-Za-zÀ-ÿ]+', '')),
        'descoberto'
     FROM esus_indicadores_raw r
     JOIN esus_cargas c ON c.id = r.carga_id
     WHERE r.secao ILIKE '%SIGTAP%'
       AND substring(r.descricao from '^\\s*(\\d{10})') IS NOT NULL
     ON CONFLICT (tipo_relatorio, descricao_esus) DO NOTHING
     RETURNING id`
  );
  return { inserted: result.rows.length };
}

module.exports = { listCompetencias, exportProducao, discoverEsusSigtapFromBlocks };
