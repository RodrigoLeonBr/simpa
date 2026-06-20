const { query } = require('./db');

const PLATAFORMA =
  'SIMPA - Sistema Integrado de Monitoramento e Planejamento de Americana';
const COMPETENCIA_RE = /^\d{4}-\d{2}$/;

function parseCompetencia(value) {
  if (!value || typeof value !== 'string') {
    return { ok: false, error: 'parâmetro competencia obrigatório (YYYY-MM)' };
  }
  if (!COMPETENCIA_RE.test(value)) {
    return { ok: false, error: 'competencia inválida — use YYYY-MM' };
  }
  return { ok: true, label: value, date: `${value}-01` };
}

function buildDashboardQuery({ competenciaDate, unidade, equipe }) {
  const conditions = ['competencia = $1'];
  const params = [competenciaDate];

  if (unidade) {
    params.push(unidade);
    conditions.push(`unidade = $${params.length}`);
  }
  if (equipe) {
    params.push(equipe);
    conditions.push(`equipe = $${params.length}`);
  }

  return {
    sql: `
      SELECT competencia, municipio, unidade, equipe, versao_schema, dados_conteudo, atualizado_em
      FROM dados_consolidados
      WHERE ${conditions.join(' AND ')}
      ORDER BY atualizado_em DESC
      LIMIT 1
    `,
    params,
  };
}

function envelopeDashboard(row, competenciaLabel) {
  const content = row.dados_conteudo || {};
  const hasEnvelope = Boolean(content.plataforma && content.versao_schema);

  if (hasEnvelope) {
    return {
      ...content,
      competencia: content.competencia || competenciaLabel,
      filtros_ativos: content.filtros_ativos || {
        unidade: row.unidade,
        equipe: row.equipe,
      },
    };
  }

  return {
    plataforma: PLATAFORMA,
    versao_schema: row.versao_schema || '3.1.0',
    competencia: competenciaLabel,
    municipio: row.municipio || 'AMERICANA',
    filtros_ativos: { unidade: row.unidade, equipe: row.equipe },
    kpis_gerais: content.kpis_gerais ?? {},
    modulos: content.modulos ?? {},
    emendas_parlamentares: content.emendas_parlamentares ?? [],
    indicadores_qualidade: content.indicadores_qualidade ?? [],
    ...content,
  };
}

async function fetchDashboard({ competencia, unidade, equipe }) {
  const parsed = parseCompetencia(competencia);
  if (!parsed.ok) {
    return { status: 400, body: { error: parsed.error } };
  }

  const { sql, params } = buildDashboardQuery({
    competenciaDate: parsed.date,
    unidade,
    equipe,
  });
  const { rows } = await query(sql, params);

  if (!rows.length) {
    return {
      status: 404,
      body: {
        error: 'Dados não encontrados para os filtros informados',
        filtros: { competencia: parsed.label, unidade: unidade || null, equipe: equipe || null },
      },
    };
  }

  return {
    status: 200,
    body: envelopeDashboard(rows[0], parsed.label),
  };
}

module.exports = {
  PLATAFORMA,
  parseCompetencia,
  buildDashboardQuery,
  envelopeDashboard,
  fetchDashboard,
};
