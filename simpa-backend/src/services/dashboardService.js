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

function parseOptionalInt(value) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildDashboardQuery({
  competenciaDate,
  unidade,
  equipe,
  estabelecimentoId,
  equipeId,
}) {
  const conditions = ['competencia = $1'];
  const params = [competenciaDate];
  const useBothIds = estabelecimentoId != null && equipeId != null;
  const useEstabelecimentoOnly = estabelecimentoId != null && equipeId == null;

  if (useBothIds) {
    params.push(estabelecimentoId, equipeId);
    conditions.push(`estabelecimento_id = $${params.length - 1}`);
    conditions.push(`equipe_id = $${params.length}`);
  } else if (useEstabelecimentoOnly) {
    params.push(estabelecimentoId);
    conditions.push(`estabelecimento_id = $${params.length}`);
  } else {
    if (unidade) {
      params.push(unidade);
      conditions.push(`unidade = $${params.length}`);
    }
    if (equipe) {
      params.push(equipe);
      conditions.push(`equipe = $${params.length}`);
    }
  }

  return {
    sql: `
      SELECT competencia, municipio, unidade, equipe, versao_schema,
             dados_conteudo, atualizado_em, estabelecimento_id, equipe_id
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

function logDashboardMiss(filtros) {
  console.log(
    JSON.stringify({
      event: 'dashboard.miss',
      ...filtros,
    })
  );
}

async function fetchCadastroLabels(estabelecimentoId, equipeId) {
  const { rows } = await query(
    `SELECT est.nome AS unidade, eq.nome AS equipe
     FROM estabelecimentos est
     JOIN equipes eq ON eq.id = $2 AND eq.estabelecimento_id = est.id
     WHERE est.id = $1`,
    [estabelecimentoId, equipeId]
  );
  return rows[0] || null;
}

async function fetchDashboard({
  competencia,
  unidade,
  equipe,
  estabelecimento_id,
  equipe_id,
}) {
  const parsed = parseCompetencia(competencia);
  if (!parsed.ok) {
    return { status: 400, body: { error: parsed.error } };
  }

  const estabelecimentoId = parseOptionalInt(estabelecimento_id);
  const equipeId = parseOptionalInt(equipe_id);

  if (estabelecimentoId == null && equipeId != null) {
    return {
      status: 400,
      body: {
        error: 'estabelecimento_id é obrigatório quando equipe_id é informado',
      },
    };
  }

  const { sql, params } = buildDashboardQuery({
    competenciaDate: parsed.date,
    unidade,
    equipe,
    estabelecimentoId,
    equipeId,
  });
  let { rows } = await query(sql, params);

  const filtros = {
    competencia: parsed.label,
    unidade: unidade || null,
    equipe: equipe || null,
    estabelecimento_id: estabelecimentoId,
    equipe_id: equipeId,
  };

  if (
    !rows.length &&
    estabelecimentoId != null &&
    equipeId != null
  ) {
    const labels = await fetchCadastroLabels(estabelecimentoId, equipeId);
    if (labels) {
      const retry = buildDashboardQuery({
        competenciaDate: parsed.date,
        unidade: labels.unidade,
        equipe: labels.equipe,
      });
      const retryResult = await query(retry.sql, retry.params);
      rows = retryResult.rows;
      if (rows.length) {
        filtros.unidade = labels.unidade;
        filtros.equipe = labels.equipe;
      }
    }
  }

  if (!rows.length) {
    if (estabelecimentoId != null) {
      logDashboardMiss(filtros);
    }
    return {
      status: 404,
      body: {
        error: 'Dados não encontrados para os filtros informados',
        filtros,
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
  parseOptionalInt,
  buildDashboardQuery,
  envelopeDashboard,
  logDashboardMiss,
  fetchCadastroLabels,
  fetchDashboard,
};
