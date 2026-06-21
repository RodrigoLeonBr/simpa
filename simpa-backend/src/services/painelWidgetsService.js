const { pool, query } = require('./db');
const { executeMetric } = require('./painelMetricsService');

const MUTABLE_FIELDS = [
  'slug',
  'perfil',
  'layout',
  'ordem',
  'tipo',
  'titulo',
  'subtitulo',
  'formato',
  'metrica_id',
  'fonte_config',
  'spark_metrica_id',
  'spark_config',
  'sql_preview',
  'delta_config',
  'status',
];

const EM_DASH = '—';

function createHttpError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  if (code) {
    error.code = code;
  }
  return error;
}

function assertPositiveInt(value, fieldName) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw createHttpError(`${fieldName} inválido`, 400, 'VALIDATION_ERROR');
  }
  return parsed;
}

function parseOptionalMetricId(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return assertPositiveInt(value, fieldName);
}

function ensureJsonObjectOrNull(value, fieldName, { allowNull = true } = {}) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    if (!allowNull) {
      throw createHttpError(`${fieldName} deve ser objeto JSON`, 400, 'VALIDATION_ERROR');
    }
    return null;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw createHttpError(`${fieldName} deve ser objeto JSON`, 400, 'VALIDATION_ERROR');
  }

  return value;
}

async function ensureMetricActive(metricId, fieldName) {
  if (metricId == null) {
    return;
  }

  const { rows } = await query(
    `SELECT id
     FROM painel_metricas_catalogo
     WHERE id = $1
       AND status = 'ativo'
     LIMIT 1`,
    [metricId]
  );

  if (!rows.length) {
    throw createHttpError(`${fieldName} inválido ou inativo`, 400, 'METRIC_INVALID');
  }
}

async function ensureUniqueSlug(perfil, layout, slug, ignoreId = null) {
  const params = [perfil, layout, slug];
  let sql = `
    SELECT id
    FROM painel_widgets
    WHERE perfil = $1
      AND layout = $2
      AND slug = $3
  `;

  if (ignoreId != null) {
    params.push(ignoreId);
    sql += ` AND id <> $${params.length}`;
  }

  sql += ' LIMIT 1';

  const { rows } = await query(sql, params);
  if (rows.length) {
    throw createHttpError(
      `Já existe widget ${slug} para ${perfil}/${layout}`,
      409,
      'WIDGET_SLUG_CONFLICT'
    );
  }
}

function normalizeCreatePayload(body = {}) {
  const payload = {};
  for (const field of MUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  }

  if (!payload.slug || !payload.perfil || !payload.layout || !payload.tipo || !payload.titulo) {
    throw createHttpError(
      'slug, perfil, layout, tipo e titulo são obrigatórios',
      400,
      'VALIDATION_ERROR'
    );
  }

  payload.ordem = payload.ordem === undefined ? 0 : assertPositiveInt(payload.ordem, 'ordem');
  payload.metrica_id = parseOptionalMetricId(payload.metrica_id, 'metrica_id');
  payload.spark_metrica_id = parseOptionalMetricId(payload.spark_metrica_id, 'spark_metrica_id');
  payload.fonte_config =
    ensureJsonObjectOrNull(payload.fonte_config, 'fonte_config', { allowNull: false }) ?? {};
  payload.spark_config = ensureJsonObjectOrNull(payload.spark_config, 'spark_config');
  payload.delta_config = ensureJsonObjectOrNull(payload.delta_config, 'delta_config');
  payload.status = payload.status || 'ativo';

  return payload;
}

function normalizeUpdatePayload(body = {}) {
  const payload = {};
  for (const field of MUTABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      payload[field] = body[field];
    }
  }

  if (Object.keys(payload).length === 0) {
    throw createHttpError('Nenhum campo para atualizar', 400, 'VALIDATION_ERROR');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'ordem')) {
    payload.ordem = assertPositiveInt(payload.ordem, 'ordem');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'metrica_id')) {
    payload.metrica_id = parseOptionalMetricId(payload.metrica_id, 'metrica_id');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'spark_metrica_id')) {
    payload.spark_metrica_id = parseOptionalMetricId(payload.spark_metrica_id, 'spark_metrica_id');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'fonte_config')) {
    payload.fonte_config =
      ensureJsonObjectOrNull(payload.fonte_config, 'fonte_config', { allowNull: false }) ?? {};
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'spark_config')) {
    payload.spark_config = ensureJsonObjectOrNull(payload.spark_config, 'spark_config');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'delta_config')) {
    payload.delta_config = ensureJsonObjectOrNull(payload.delta_config, 'delta_config');
  }

  return payload;
}

const BASE_SELECT = `
  SELECT w.*,
         m.label AS metrica_label,
         m.sql_template AS metrica_sql_template,
         sm.label AS spark_metrica_label,
         sm.sql_template AS spark_metrica_sql_template
  FROM painel_widgets w
  LEFT JOIN painel_metricas_catalogo m ON m.id = w.metrica_id
  LEFT JOIN painel_metricas_catalogo sm ON sm.id = w.spark_metrica_id
`;

function formatByFormato(value, formato) {
  if (value == null) {
    return EM_DASH;
  }

  if (formato === 'percentual') {
    return `${new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Number(value) * 100)}%`;
  }

  if (formato === 'moeda') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  if (formato === 'texto') {
    return String(value);
  }

  return new Intl.NumberFormat('pt-BR').format(Number(value));
}

function getPreviousCompetencia(competencia) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(competencia));
  if (!match) {
    return competencia;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const current = new Date(Date.UTC(year, month - 1, 1));
  current.setUTCMonth(current.getUTCMonth() - 1);
  const prevYear = current.getUTCFullYear();
  const prevMonth = String(current.getUTCMonth() + 1).padStart(2, '0');
  return `${prevYear}-${prevMonth}`;
}

function computeDelta(current, previous) {
  if (current == null || previous == null || previous === 0) {
    return { label: EM_DASH, direction: 'flat' };
  }

  const pct = ((current - previous) / previous) * 100;
  const signal = pct > 0 ? '▲' : pct < 0 ? '▼' : '0';
  const label = `${signal} ${Math.abs(pct).toFixed(1).replace('.', ',')}%`;
  if (pct > 0) return { label, direction: 'up' };
  if (pct < 0) return { label, direction: 'down' };
  return { label: '0 estável', direction: 'flat' };
}

async function getMetricByChave(chave) {
  const { rows } = await query(
    `SELECT id, chave
     FROM painel_metricas_catalogo
     WHERE chave = $1
       AND status = 'ativo'
     LIMIT 1`,
    [chave]
  );

  return rows[0] || null;
}

async function resolveMetricValue(metricaId, scope, fallbackChave = null) {
  if (!metricaId) {
    return { rows: [], single: null };
  }

  const primary = await executeMetric(metricaId, scope);
  if (primary.single != null) {
    return primary;
  }

  if (!fallbackChave) {
    return primary;
  }

  const fallbackMetric = await getMetricByChave(fallbackChave);
  if (!fallbackMetric) {
    return primary;
  }

  return executeMetric(fallbackMetric.id, scope);
}

function buildScope(scope = {}) {
  return {
    competencia: scope.competencia,
    estabelecimentoId: scope.estabelecimentoId ?? null,
    equipeId: scope.equipeId ?? null,
  };
}

async function resolveDelta(widget, scope, currentValue) {
  const deltaConfig = widget.delta_config || {};
  if (!deltaConfig || typeof deltaConfig !== 'object') {
    return undefined;
  }

  if (deltaConfig.tipo === 'fixo') {
    return {
      label: deltaConfig.label || EM_DASH,
      direction: 'flat',
    };
  }

  if (deltaConfig.tipo !== 'competencia_anterior' || !widget.metrica_id) {
    return undefined;
  }

  const previousScope = {
    ...scope,
    competencia: getPreviousCompetencia(scope.competencia),
  };
  const fallbackChave = widget.fonte_config?.fallback_chave;
  const previousResult = await resolveMetricValue(
    widget.metrica_id,
    previousScope,
    fallbackChave
  );
  return computeDelta(currentValue, previousResult.single);
}

async function resolveSparkSeries(widget, scope) {
  if (!widget.spark_metrica_id) {
    return undefined;
  }

  const sparkResult = await executeMetric(widget.spark_metrica_id, scope);
  if (!Array.isArray(sparkResult.rows)) {
    return [];
  }

  return sparkResult.rows
    .map((row) => Number(row?.valor))
    .filter((value) => Number.isFinite(value));
}

async function resolveCardWidget(widget, scope) {
  const fallbackChave = widget.fonte_config?.fallback_chave;
  const metricResult = await resolveMetricValue(widget.metrica_id, scope, fallbackChave);

  if (widget.formato === 'fracao') {
    const parChave = widget.fonte_config?.par_chave;
    let denominator = null;
    if (parChave) {
      const parMetric = await getMetricByChave(parChave);
      if (parMetric) {
        const parResult = await executeMetric(parMetric.id, scope);
        denominator = parResult.single;
      }
    }

    const numerator = metricResult.single;
    const valueLabel =
      numerator == null && denominator == null
        ? EM_DASH
        : `${numerator ?? 0} / ${denominator ?? 0}`;

    return {
      slug: widget.slug,
      ordem: widget.ordem,
      tipo: widget.tipo,
      titulo: widget.titulo,
      subtitulo: widget.subtitulo,
      formato: widget.formato,
      value: numerator,
      valueLabel,
      isNull: numerator == null && denominator == null,
      delta: await resolveDelta(widget, scope, numerator),
      sparkSeries: await resolveSparkSeries(widget, scope),
    };
  }

  const value = metricResult.single;
  return {
    slug: widget.slug,
    ordem: widget.ordem,
    tipo: widget.tipo,
    titulo: widget.titulo,
    subtitulo: widget.subtitulo,
    formato: widget.formato,
    value,
    valueLabel: formatByFormato(value, widget.formato),
    isNull: value == null,
    delta: await resolveDelta(widget, scope, value),
    sparkSeries: await resolveSparkSeries(widget, scope),
  };
}

function mapLineSeries(rows = []) {
  return rows
    .map((row) => ({
      competencia: String(row.competencia || ''),
      valor: Number(row.valor),
    }))
    .filter((item) => item.competencia && Number.isFinite(item.valor));
}

function mapRankingRows(rows = [], formato = 'numero', limite = 6) {
  return rows
    .map((row) => ({
      label: row.unidade || row.label || '',
      valor: Number(row.valor),
      valueLabel: formatByFormato(Number(row.valor), formato),
      estabelecimento_id:
        row.estabelecimento_id == null ? undefined : Number(row.estabelecimento_id),
    }))
    .filter((item) => item.label && Number.isFinite(item.valor))
    .slice(0, limite);
}

async function resolveLineWidget(widget, scope) {
  const metricResult = await resolveMetricValue(
    widget.metrica_id,
    scope,
    widget.fonte_config?.fallback_chave
  );
  const series = mapLineSeries(metricResult.rows);
  return {
    slug: widget.slug,
    ordem: widget.ordem,
    tipo: widget.tipo,
    titulo: widget.titulo,
    subtitulo: widget.subtitulo,
    formato: widget.formato,
    value: null,
    valueLabel: EM_DASH,
    isNull: series.length === 0,
    series,
  };
}

async function resolveRankingWidget(widget, scope) {
  const metricResult = await resolveMetricValue(
    widget.metrica_id,
    scope,
    widget.fonte_config?.fallback_chave
  );
  const limite = Number.parseInt(String(widget.fonte_config?.limite ?? 6), 10) || 6;
  let ranking = mapRankingRows(metricResult.rows, widget.formato, limite);

  if (scope.estabelecimentoId != null) {
    ranking = ranking
      .filter((item) => item.estabelecimento_id === Number(scope.estabelecimentoId))
      .slice(0, 1);
  }

  return {
    slug: widget.slug,
    ordem: widget.ordem,
    tipo: widget.tipo,
    titulo: widget.titulo,
    subtitulo: widget.subtitulo,
    formato: widget.formato,
    value: null,
    valueLabel: EM_DASH,
    isNull: ranking.length === 0,
    ranking,
  };
}

async function resolveSingleWidget(widget, scope) {
  if (widget.tipo === 'card') {
    return resolveCardWidget(widget, scope);
  }
  if (widget.tipo === 'grafico_linha') {
    return resolveLineWidget(widget, scope);
  }
  if (widget.tipo === 'grafico_ranking' || widget.tipo === 'grafico_barra') {
    return resolveRankingWidget(widget, scope);
  }

  return {
    slug: widget.slug,
    ordem: widget.ordem,
    tipo: widget.tipo,
    titulo: widget.titulo,
    subtitulo: widget.subtitulo,
    formato: widget.formato,
    value: null,
    valueLabel: EM_DASH,
    isNull: true,
  };
}

async function listWidgets({ perfil, layout, includeInactive = false } = {}) {
  if (!perfil || !layout) {
    throw createHttpError('perfil e layout são obrigatórios', 400, 'VALIDATION_ERROR');
  }

  const params = [perfil, layout];
  const conditions = ['w.perfil = $1', 'w.layout = $2'];
  if (!includeInactive) {
    conditions.push(`w.status = 'ativo'`);
  }

  const { rows } = await query(
    `${BASE_SELECT}
     WHERE ${conditions.join(' AND ')}
     ORDER BY w.ordem ASC, w.id ASC`,
    params
  );

  return rows;
}

async function getWidgetById(id) {
  const widgetId = assertPositiveInt(id, 'id');
  const { rows } = await query(
    `${BASE_SELECT}
     WHERE w.id = $1
     LIMIT 1`,
    [widgetId]
  );

  if (!rows.length) {
    throw createHttpError('Widget não encontrado', 404, 'WIDGET_NOT_FOUND');
  }

  return rows[0];
}

async function createWidget(body) {
  const payload = normalizeCreatePayload(body);
  await ensureMetricActive(payload.metrica_id, 'metrica_id');
  await ensureMetricActive(payload.spark_metrica_id, 'spark_metrica_id');
  await ensureUniqueSlug(payload.perfil, payload.layout, payload.slug);

  const { rows } = await query(
    `INSERT INTO painel_widgets (
       slug, perfil, layout, ordem, tipo, titulo, subtitulo, formato,
       metrica_id, fonte_config, spark_metrica_id, spark_config, sql_preview, delta_config, status,
       atualizado_em
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8,
       $9, $10::jsonb, $11, $12::jsonb, $13, $14::jsonb, $15,
       now()
     )
     RETURNING id`,
    [
      payload.slug,
      payload.perfil,
      payload.layout,
      payload.ordem,
      payload.tipo,
      payload.titulo,
      payload.subtitulo ?? null,
      payload.formato ?? 'numero',
      payload.metrica_id,
      JSON.stringify(payload.fonte_config),
      payload.spark_metrica_id,
      payload.spark_config == null ? null : JSON.stringify(payload.spark_config),
      payload.sql_preview ?? null,
      payload.delta_config == null ? null : JSON.stringify(payload.delta_config),
      payload.status,
    ]
  );

  return getWidgetById(rows[0].id);
}

async function updateWidget(id, body) {
  const widgetId = assertPositiveInt(id, 'id');
  const current = await getWidgetById(widgetId);
  const payload = normalizeUpdatePayload(body);

  const merged = {
    perfil: payload.perfil ?? current.perfil,
    layout: payload.layout ?? current.layout,
    slug: payload.slug ?? current.slug,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'metrica_id')) {
    await ensureMetricActive(payload.metrica_id, 'metrica_id');
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'spark_metrica_id')) {
    await ensureMetricActive(payload.spark_metrica_id, 'spark_metrica_id');
  }
  if (
    Object.prototype.hasOwnProperty.call(payload, 'slug') ||
    Object.prototype.hasOwnProperty.call(payload, 'perfil') ||
    Object.prototype.hasOwnProperty.call(payload, 'layout')
  ) {
    await ensureUniqueSlug(merged.perfil, merged.layout, merged.slug, widgetId);
  }

  const fields = [];
  const params = [];
  const push = (field, value) => {
    params.push(value);
    fields.push(`${field} = $${params.length}`);
  };

  for (const [field, value] of Object.entries(payload)) {
    if (field === 'fonte_config' || field === 'spark_config' || field === 'delta_config') {
      params.push(value == null ? null : JSON.stringify(value));
      fields.push(`${field} = $${params.length}::jsonb`);
      continue;
    }
    push(field, value);
  }

  fields.push('atualizado_em = now()');
  params.push(widgetId);

  const { rows } = await query(
    `UPDATE painel_widgets
     SET ${fields.join(', ')}
     WHERE id = $${params.length}
     RETURNING id`,
    params
  );

  if (!rows.length) {
    throw createHttpError('Widget não encontrado', 404, 'WIDGET_NOT_FOUND');
  }

  return getWidgetById(widgetId);
}

async function reorderWidgets(perfil, layout, orderedIds) {
  if (!perfil || !layout || !Array.isArray(orderedIds) || !orderedIds.length) {
    throw createHttpError(
      'perfil, layout e orderedIds são obrigatórios',
      400,
      'VALIDATION_ERROR'
    );
  }

  const ids = orderedIds.map((id) => assertPositiveInt(id, 'orderedIds'));
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    throw createHttpError('orderedIds possui IDs duplicados', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const check = await client.query(
      `SELECT id
       FROM painel_widgets
       WHERE perfil = $1
         AND layout = $2
         AND id = ANY($3::bigint[])
         AND status = 'ativo'`,
      [perfil, layout, ids]
    );

    if (check.rows.length !== ids.length) {
      throw createHttpError(
        'orderedIds contém widget inexistente ou fora do escopo',
        400,
        'VALIDATION_ERROR'
      );
    }

    for (let index = 0; index < ids.length; index += 1) {
      await client.query(
        `UPDATE painel_widgets
         SET ordem = $1,
             atualizado_em = now()
         WHERE id = $2`,
        [index + 1, ids[index]]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return listWidgets({ perfil, layout, includeInactive: true });
}

async function inactivateWidget(id) {
  const widgetId = assertPositiveInt(id, 'id');

  const { rows } = await query(
    `UPDATE painel_widgets
     SET status = 'inativo',
         atualizado_em = now()
     WHERE id = $1
     RETURNING id, status`,
    [widgetId]
  );

  if (!rows.length) {
    throw createHttpError('Widget não encontrado', 404, 'WIDGET_NOT_FOUND');
  }

  return rows[0];
}

function normalizePreviewDraft(widget = {}) {
  const draft = {
    id: null,
    slug: widget.slug || 'preview_widget',
    ordem: Number.parseInt(String(widget.ordem ?? 0), 10) || 0,
    tipo: widget.tipo || 'card',
    titulo: widget.titulo || 'Preview',
    subtitulo: widget.subtitulo ?? null,
    formato: widget.formato || 'numero',
    metrica_id: parseOptionalMetricId(widget.metrica_id, 'metrica_id'),
    fonte_config: ensureJsonObjectOrNull(widget.fonte_config ?? {}, 'fonte_config', {
      allowNull: false,
    }),
    spark_metrica_id: parseOptionalMetricId(widget.spark_metrica_id, 'spark_metrica_id'),
    spark_config: ensureJsonObjectOrNull(widget.spark_config, 'spark_config'),
    delta_config: ensureJsonObjectOrNull(widget.delta_config, 'delta_config'),
  };

  return draft;
}

async function resolvePainelLayout({
  perfil = 'APS',
  layout = 'A',
  competencia,
  estabelecimentoId = null,
  equipeId = null,
}) {
  const startedAt = Date.now();
  const scope = buildScope({ competencia, estabelecimentoId, equipeId });
  const widgets = await listWidgets({ perfil, layout, includeInactive: false });

  if (!widgets.length) {
    throw createHttpError('Nenhum widget ativo para perfil/layout informado', 404, 'WIDGETS_NOT_FOUND');
  }

  const resolved = [];
  for (const widget of widgets) {
    resolved.push(await resolveSingleWidget(widget, scope));
  }

  console.log(
    JSON.stringify({
      event: 'painel.layout.resolve',
      perfil,
      layout,
      competencia,
      widgetCount: resolved.length,
      durationMs: Date.now() - startedAt,
    })
  );

  return {
    perfil,
    layout,
    competencia,
    widgets: resolved,
  };
}

async function previewWidget(widgetOrId, scope = {}) {
  const normalizedScope = buildScope(scope);
  const widget =
    typeof widgetOrId === 'number' || /^\d+$/.test(String(widgetOrId))
      ? await getWidgetById(widgetOrId)
      : normalizePreviewDraft(widgetOrId);

  return resolveSingleWidget(widget, normalizedScope);
}

module.exports = {
  MUTABLE_FIELDS,
  createHttpError,
  listWidgets,
  getWidgetById,
  createWidget,
  updateWidget,
  reorderWidgets,
  inactivateWidget,
  resolvePainelLayout,
  previewWidget,
  normalizeCreatePayload,
  normalizeUpdatePayload,
  normalizePreviewDraft,
  ensureJsonObjectOrNull,
  ensureMetricActive,
  ensureUniqueSlug,
  getPreviousCompetencia,
  computeDelta,
  resolveMetricValue,
  mapLineSeries,
  mapRankingRows,
};
