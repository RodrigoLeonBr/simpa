'use strict';

const { query } = require('./db');

function normalizeCompetenciaDate(competencia) {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return null;
  return `${competencia}-01`;
}

/**
 * listInternacoes — consulta sih_internacoes com filtros opcionais.
 * Aceita estabelecimentoId (camelCase interno) ou estabelecimento_id (snake_case de req.query).
 * JOIN com rubricas_sia via financiamento 2-char = codigo_rubrica (direto, sem LEFT()).
 */
async function listInternacoes(params = {}) {
  const { competencia, cnes } = params;
  const estabelecimentoId = params.estabelecimentoId ?? params.estabelecimento_id;

  const conditions = [];
  const values = [];

  if (competencia) {
    const d = normalizeCompetenciaDate(competencia);
    if (d) {
      values.push(d);
      conditions.push(`si.competencia = $${values.length}`);
    }
  }
  if (cnes) {
    values.push(cnes);
    conditions.push(`si.cnes = $${values.length}`);
  }
  if (estabelecimentoId != null) {
    values.push(Number(estabelecimentoId));
    conditions.push(`si.estabelecimento_id = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT
         si.id,
         si.competencia,
         si.cnes,
         si.estabelecimento_id,
         si.proc_principal,
         si.diag_principal,
         si.complexidade,
         si.financiamento,
         si.motivo_saida,
         si.sexo,
         si.qtd_aih,
         si.total_diarias,
         si.total_diarias_uti,
         si.total_valor,
         si.media_idade,
         si.media_diarias,
         rs.descricao AS descricao_financiamento
     FROM sih_internacoes si
     LEFT JOIN rubricas_sia rs ON si.financiamento = rs.codigo_rubrica
     ${where}
     ORDER BY si.total_valor DESC
     LIMIT 500`,
    values
  );
  return rows;
}

/**
 * listProcedimentos — consulta sih_procedimentos com filtros opcionais.
 * JOIN com cbos_sia via cbo_profissional = codigo_cbo.
 */
async function listProcedimentos(params = {}) {
  const { competencia, cnes } = params;
  const estabelecimentoId = params.estabelecimentoId ?? params.estabelecimento_id;

  const conditions = [];
  const values = [];

  if (competencia) {
    const d = normalizeCompetenciaDate(competencia);
    if (d) {
      values.push(d);
      conditions.push(`sp.competencia = $${values.length}`);
    }
  }
  if (cnes) {
    values.push(cnes);
    conditions.push(`sp.cnes = $${values.length}`);
  }
  if (estabelecimentoId != null) {
    values.push(Number(estabelecimentoId));
    conditions.push(`sp.estabelecimento_id = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT
         sp.id,
         sp.competencia,
         sp.cnes,
         sp.estabelecimento_id,
         sp.proc_detalhado,
         sp.cbo_profissional,
         sp.financiamento_detalhe,
         sp.qtd_aih_distintas,
         sp.total_quantidade,
         sp.total_valor_item,
         cs.descricao AS descricao_cbo
     FROM sih_procedimentos sp
     LEFT JOIN cbos_sia cs ON sp.cbo_profissional = cs.codigo_cbo
     ${where}
     ORDER BY sp.total_valor_item DESC
     LIMIT 500`,
    values
  );
  return rows;
}

/**
 * getSihSummary — KPIs agregados para o consolidador (task_05).
 * Retorna: total_aih, total_valor, pct_diarias_uti, taxa_mortalidade.
 */
async function getSihSummary(competencia, estabelecimentoId) {
  const conditions = [];
  const values = [];

  if (competencia) {
    const d = normalizeCompetenciaDate(competencia);
    if (d) {
      values.push(d);
      conditions.push(`si.competencia = $${values.length}`);
    }
  }
  if (estabelecimentoId != null) {
    values.push(Number(estabelecimentoId));
    conditions.push(`si.estabelecimento_id = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT
         SUM(si.qtd_aih)::bigint                                              AS total_aih,
         SUM(si.total_valor)::numeric                                          AS total_valor,
         ROUND(
             SUM(si.total_diarias_uti)::numeric * 100.0
             / NULLIF(SUM(si.total_diarias), 0),
             2
         )                                                                     AS pct_diarias_uti,
         ROUND(
             SUM(CASE WHEN si.motivo_saida IN ('31','32')
                      THEN si.qtd_aih ELSE 0 END)::numeric
             * 100.0 / NULLIF(SUM(si.qtd_aih), 0),
             2
         )                                                                     AS taxa_mortalidade
     FROM sih_internacoes si
     ${where}`,
    values
  );

  const row = rows[0] || {};
  return {
    total_aih: Number(row.total_aih || 0),
    total_valor: Number(row.total_valor || 0),
    pct_diarias_uti: Number(row.pct_diarias_uti || 0),
    taxa_mortalidade: Number(row.taxa_mortalidade || 0),
  };
}

/**
 * listInternacoesPorCapituloCid — distribuição por capítulo CID-10 (task_05).
 * Retorna: [{capitulo, qtd_aih, total_valor}] ordenado por qtd_aih DESC.
 */
async function listInternacoesPorCapituloCid(competencia, estabelecimentoId) {
  const conditions = [
    "si.diag_principal IS NOT NULL",
    "si.diag_principal != ''",
  ];
  const values = [];

  if (competencia) {
    const d = normalizeCompetenciaDate(competencia);
    if (d) {
      values.push(d);
      conditions.push(`si.competencia = $${values.length}`);
    }
  }
  if (estabelecimentoId != null) {
    values.push(Number(estabelecimentoId));
    conditions.push(`si.estabelecimento_id = $${values.length}`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await query(
    `SELECT
         LEFT(si.diag_principal, 1)  AS capitulo,
         SUM(si.qtd_aih)::bigint     AS qtd_aih,
         SUM(si.total_valor)::numeric AS total_valor
     FROM sih_internacoes si
     ${where}
     GROUP BY LEFT(si.diag_principal, 1)
     ORDER BY qtd_aih DESC`,
    values
  );
  return rows;
}

module.exports = {
  listInternacoes,
  listProcedimentos,
  getSihSummary,
  listInternacoesPorCapituloCid,
};
