const { query } = require('./db');

const COMPETENCIA_RE = /^(\d{4})-(\d{2})$/;
const PLACEHOLDER_ORDER = ['competencia', 'estabelecimento_id', 'equipe_id'];
const PLACEHOLDER_INDEX = PLACEHOLDER_ORDER.reduce((acc, key, idx) => {
  acc[key] = idx + 1;
  return acc;
}, {});
const NAMED_TOKEN_RE = /(?<!:):([a-zA-Z_][a-zA-Z0-9_]*)/g;
const METRIC_KEY_MAX = 160;

class MetricNotFoundError extends Error {
  constructor(message = 'Métrica não encontrada ou inativa') {
    super(message);
    this.name = 'MetricNotFoundError';
    this.code = 'METRIC_NOT_FOUND';
    this.status = 404;
  }
}

class InvalidMetricTemplateError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidMetricTemplateError';
    this.code = 'INVALID_METRIC_TEMPLATE';
    this.status = 400;
  }
}

class InvalidMetricScopeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidMetricScopeError';
    this.code = 'INVALID_METRIC_SCOPE';
    this.status = 400;
  }
}

function parseCompetencia(competencia) {
  if (!competencia || typeof competencia !== 'string') {
    throw new InvalidMetricScopeError('competencia obrigatória (YYYY-MM)');
  }

  const match = COMPETENCIA_RE.exec(competencia);
  if (!match) {
    throw new InvalidMetricScopeError('competencia inválida — use YYYY-MM');
  }

  const month = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    throw new InvalidMetricScopeError('competencia inválida — mês fora do intervalo 01-12');
  }

  return `${competencia}-01`;
}

function parseOptionalBigInt(value, field) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new InvalidMetricScopeError(`${field} inválido`);
  }

  return parsed;
}

function hasMultipleStatements(sql) {
  const trimmed = sql.trim();
  if (!trimmed) {
    return true;
  }

  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, '');
  return withoutTrailingSemicolon.includes(';');
}

function bindTemplate(sql, scope) {
  if (!sql || typeof sql !== 'string') {
    throw new InvalidMetricTemplateError('sql_template inválido');
  }

  if (hasMultipleStatements(sql)) {
    throw new InvalidMetricTemplateError('sql_template deve conter apenas uma statement');
  }

  const scopeValues = {
    competencia: parseCompetencia(scope?.competencia),
    estabelecimento_id: parseOptionalBigInt(scope?.estabelecimentoId, 'estabelecimento_id'),
    equipe_id: parseOptionalBigInt(scope?.equipeId, 'equipe_id'),
  };

  const invalidTokens = new Set();
  let tokenMatch = NAMED_TOKEN_RE.exec(sql);
  while (tokenMatch) {
    const token = tokenMatch[1];
    if (!Object.prototype.hasOwnProperty.call(PLACEHOLDER_INDEX, token)) {
      invalidTokens.add(token);
    }
    tokenMatch = NAMED_TOKEN_RE.exec(sql);
  }
  NAMED_TOKEN_RE.lastIndex = 0;

  if (invalidTokens.size > 0) {
    throw new InvalidMetricTemplateError(
      `placeholder(s) não permitido(s): ${Array.from(invalidTokens).join(', ')}`
    );
  }

  const usedPlaceholders = PLACEHOLDER_ORDER.filter((token) =>
    new RegExp(`(?<!:):${token}(?![a-zA-Z0-9_])`).test(sql)
  );
  const usedIndex = usedPlaceholders.reduce((acc, token, idx) => {
    acc[token] = idx + 1;
    return acc;
  }, {});

  const text = sql.replace(
    NAMED_TOKEN_RE,
    (_, token) => `$${usedIndex[token]}`
  );
  const values = usedPlaceholders.map((token) => scopeValues[token]);

  return { text, values };
}

function extractSingleValue(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const raw = rows[0]?.valor;
  if (raw == null) {
    return null;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function slugifySegment(value) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');

  return normalized || 'sem-dados';
}

function buildMetricKey({ tipo_relatorio, secao, descricao, campo_json }) {
  const base = `esus.${slugifySegment(tipo_relatorio)}.${slugifySegment(secao)}.${slugifySegment(descricao)}.${slugifySegment(campo_json)}`;
  if (base.length <= METRIC_KEY_MAX) {
    return base;
  }
  return base.slice(0, METRIC_KEY_MAX);
}

function escapeSqlLiteral(value) {
  return String(value || '').replace(/'/g, "''");
}

function buildDiscoveredSqlTemplate({ tipo_relatorio, secao, descricao, campo_json }) {
  const tipo = escapeSqlLiteral(tipo_relatorio);
  const sec = escapeSqlLiteral(secao);
  const desc = escapeSqlLiteral(descricao);
  const campo = escapeSqlLiteral(campo_json);

  return `SELECT NULLIF(r.valores->>'${campo}', '')::numeric AS valor
FROM esus_cargas c
JOIN esus_indicadores_raw r ON r.carga_id = c.id
WHERE c.competencia = :competencia::date
  AND (:estabelecimento_id::bigint IS NULL OR c.estabelecimento_id = :estabelecimento_id::bigint)
  AND (:equipe_id::bigint IS NULL OR c.equipe_id = :equipe_id::bigint)
  AND c.tipo_relatorio = '${tipo}'
  AND r.secao = '${sec}'
  AND r.descricao = '${desc}'
LIMIT 1`;
}

/**
 * Descobre métricas em `esus_indicadores_raw` e faz UPSERT no catálogo.
 *
 * Regras:
 * - chave estável `esus.{tipo}.{secao}.{descricao}.{campo}`
 * - `fonte_tipo='esus_raw'` e `agregacao='valor_unico'`
 * - em conflito por chave: soma `ocorrencias`, atualiza `ultima_carga_em`
 * - preserva `sql_template` já curado quando status ativo e não vazio
 */
async function discoverMetricsFromRaw() {
  const scan = await query(
    `SELECT
       c.tipo_relatorio,
       r.secao,
       r.descricao,
       keys.campo_json,
       COUNT(*)::int AS ocorrencias,
       MAX(c.importado_em) AS ultima_carga_em
     FROM esus_cargas c
     JOIN esus_indicadores_raw r ON r.carga_id = c.id
     CROSS JOIN LATERAL (
       SELECT jsonb_object_keys(r.valores) AS campo_json
     ) keys
     GROUP BY c.tipo_relatorio, r.secao, r.descricao, keys.campo_json
     ORDER BY c.tipo_relatorio, r.secao, r.descricao, keys.campo_json`
  );

  if (!scan.rows.length) {
    return { inserted: 0, updated: 0 };
  }

  let inserted = 0;
  let updated = 0;

  for (const row of scan.rows) {
    const chave = buildMetricKey(row);
    const sqlTemplate = buildDiscoveredSqlTemplate(row);
    const label = `${row.secao} · ${row.descricao} (${row.campo_json})`.slice(0, 200);

    const upsert = await query(
      `INSERT INTO painel_metricas_catalogo (
         chave, fonte_tipo, label, descricao, tipo_relatorio, secao, descricao_linha, campo_json,
         agregacao, sql_template, ocorrencias, ultima_carga_em, descoberto_em, status
       ) VALUES (
         $1, 'esus_raw', $2, $3, $4, $5, $6, $7,
         'valor_unico', $8, $9, $10, now(), 'ativo'
       )
       ON CONFLICT (chave) DO UPDATE SET
         label = EXCLUDED.label,
         descricao = EXCLUDED.descricao,
         tipo_relatorio = EXCLUDED.tipo_relatorio,
         secao = EXCLUDED.secao,
         descricao_linha = EXCLUDED.descricao_linha,
         campo_json = EXCLUDED.campo_json,
         agregacao = EXCLUDED.agregacao,
         ultima_carga_em = EXCLUDED.ultima_carga_em,
         ocorrencias = painel_metricas_catalogo.ocorrencias + EXCLUDED.ocorrencias,
         sql_template = CASE
           WHEN painel_metricas_catalogo.status = 'ativo'
            AND COALESCE(BTRIM(painel_metricas_catalogo.sql_template), '') <> ''
           THEN painel_metricas_catalogo.sql_template
           ELSE EXCLUDED.sql_template
         END
       RETURNING (xmax = 0) AS inserted`,
      [
        chave,
        label,
        `Descoberta automática de e-SUS (${row.tipo_relatorio})`,
        row.tipo_relatorio,
        row.secao,
        row.descricao,
        row.campo_json,
        sqlTemplate,
        row.ocorrencias,
        row.ultima_carga_em,
      ]
    );

    if (upsert.rows[0]?.inserted) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  return { inserted, updated };
}

async function listMetricas({ q, fonte_tipo, page = 1, limit = 20 } = {}) {
  const safePage = Math.max(Number.parseInt(String(page), 10) || 1, 1);
  const safeLimit = Math.min(Math.max(Number.parseInt(String(limit), 10) || 20, 1), 100);
  const offset = (safePage - 1) * safeLimit;

  const where = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(label ILIKE $${params.length} OR chave ILIKE $${params.length})`);
  }
  if (fonte_tipo) {
    params.push(fonte_tipo);
    where.push(`fonte_tipo = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const orderClause = q ? 'ORDER BY label ASC, ocorrencias DESC' : 'ORDER BY ocorrencias DESC, label ASC';

  const countSql = `SELECT COUNT(*)::int AS total FROM painel_metricas_catalogo ${whereClause}`;
  const countResult = await query(countSql, params);
  const total = countResult.rows[0]?.total ?? 0;

  const listParams = [...params, safeLimit, offset];
  const rowsSql = `SELECT id, chave, fonte_tipo, label, descricao, tipo_relatorio, agregacao, ocorrencias, status, ultima_carga_em
                   FROM painel_metricas_catalogo
                   ${whereClause}
                   ${orderClause}
                   LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`;
  const result = await query(rowsSql, listParams);

  return {
    data: result.rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

async function getMetricaById(id) {
  const metricId = Number.parseInt(String(id), 10);
  if (!Number.isFinite(metricId) || metricId < 1) {
    const err = new MetricNotFoundError('Métrica não encontrada');
    err.status = 404;
    throw err;
  }

  const result = await query(
    `SELECT *
     FROM painel_metricas_catalogo
     WHERE id = $1
     LIMIT 1`,
    [metricId]
  );

  if (!result.rows.length) {
    throw new MetricNotFoundError('Métrica não encontrada');
  }

  return result.rows[0];
}

async function executeSqlTemplate(sqlTemplate, scope) {
  const bound = bindTemplate(sqlTemplate, scope);
  const execution = await query(bound.text, bound.values);

  return {
    rows: execution.rows,
    single: extractSingleValue(execution.rows),
  };
}

async function executeMetric(metricaId, scope) {
  const parsedMetricId = Number.parseInt(String(metricaId), 10);
  if (!Number.isFinite(parsedMetricId) || parsedMetricId < 1) {
    throw new InvalidMetricScopeError('metricaId inválido');
  }

  const metricResult = await query(
    `SELECT id, chave, sql_template
     FROM painel_metricas_catalogo
     WHERE id = $1
       AND status = 'ativo'
     LIMIT 1`,
    [parsedMetricId]
  );

  if (!metricResult.rows.length) {
    throw new MetricNotFoundError(`Métrica ${parsedMetricId} não encontrada`);
  }

  return executeSqlTemplate(metricResult.rows[0].sql_template, scope);
}

module.exports = {
  PLACEHOLDER_ORDER,
  MetricNotFoundError,
  InvalidMetricTemplateError,
  InvalidMetricScopeError,
  bindTemplate,
  executeSqlTemplate,
  executeMetric,
  extractSingleValue,
  slugifySegment,
  buildMetricKey,
  buildDiscoveredSqlTemplate,
  discoverMetricsFromRaw,
  listMetricas,
  getMetricaById,
};
