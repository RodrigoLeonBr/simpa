const { query } = require('./db');

const VALID_PERFIS = ['APS', 'MAC', 'Hospitalar', 'Misto', 'Outro'];
const VALID_SLUGS = ['aps', 'mac', 'hospitalar', 'misto', 'outro'];

const PERFIL_TO_SLUG = {
  APS: 'aps',
  MAC: 'mac',
  Hospitalar: 'hospitalar',
  Misto: 'misto',
  Outro: 'outro',
};

const FORBIDDEN_IDENTITY_KEYS = [
  'id',
  'codigo_externo',
  'nome',
  'cnpj',
  're_tipo',
  'tipouni',
  'perfil',
  'perfil_editado',
  'area',
  'relatorio',
  'status',
  'sincronizado_em',
  'criado_em',
  'enriquecimento',
  'enrichment',
  'estabelecimento_id',
  'atualizado_em',
];

const ENRICHMENT_ALLOWED_KEYS = {
  aps: [
    'notas_territorio',
    'cobertura_populacional',
    'vinculo_esus',
    'prioridades_planejamento',
    'notas',
  ],
  mac: ['capacidades', 'relacionamento_referencia', 'autorizacoes', 'notas'],
  hospitalar: [
    'leitos',
    'especialidades',
    'habilitacoes',
    'capacidade_notas',
    'notas',
  ],
  misto: ['leitos', 'capacidades_ambulatoriais', 'notas_mac', 'notas'],
  outro: ['notas'],
};

const LEGACY_ENRICHMENT_KEYS = ['leitos', 'especialidades', 'habilitacoes', 'notas'];

const DETAIL_SELECT = `
  SELECT e.id, e.codigo_externo, e.nome, e.cnpj, e.re_tipo, e.tipouni, e.perfil,
         e.perfil_editado, e.area, e.relatorio, e.status, e.sincronizado_em,
         ea.notas_territorio, ea.cobertura_populacional, ea.vinculo_esus,
         ea.prioridades_planejamento, ea.notas AS aps_notas,
         em.capacidades AS mac_capacidades, em.relacionamento_referencia,
         em.autorizacoes, em.notas AS mac_notas,
         eh.leitos AS eh_leitos, eh.especialidades, eh.habilitacoes,
         eh.capacidade_notas, eh.notas AS eh_notas,
         emi.leitos AS emi_leitos, emi.capacidades_ambulatoriais,
         emi.notas_mac, emi.notas AS emi_notas,
         eo.notas AS outro_notas
  FROM estabelecimentos e
  LEFT JOIN enriquecimento_aps ea ON ea.estabelecimento_id = e.id
  LEFT JOIN enriquecimento_mac em ON em.estabelecimento_id = e.id
  LEFT JOIN enriquecimento_hospitalar eh ON eh.estabelecimento_id = e.id
  LEFT JOIN enriquecimento_misto emi ON emi.estabelecimento_id = e.id
  LEFT JOIN enriquecimento_outro eo ON eo.estabelecimento_id = e.id
`;

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateLeitos(leitos) {
  if (
    typeof leitos !== 'object' ||
    leitos === null ||
    Array.isArray(leitos)
  ) {
    return 'leitos deve ser um objeto';
  }
  for (const [key, value] of Object.entries(leitos)) {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      return `leitos.${key} deve ser número >= 0`;
    }
  }
  return null;
}

function validateStringArray(value, fieldName) {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === 'string')
  ) {
    return `${fieldName} deve ser array de strings`;
  }
  return null;
}

function validateOptionalString(value, fieldName, maxLength) {
  if (value === undefined) {
    return null;
  }
  if (typeof value !== 'string') {
    return `${fieldName} deve ser string`;
  }
  if (maxLength && value.length > maxLength) {
    return `${fieldName} deve ter no máximo ${maxLength} caracteres`;
  }
  return null;
}

function validateEnrichmentForSlug(slug, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Corpo deve ser um objeto JSON de enriquecimento' };
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    return { ok: false, error: 'Nenhum campo de enriquecimento informado' };
  }

  const forbidden = keys.filter((key) => FORBIDDEN_IDENTITY_KEYS.includes(key));
  if (forbidden.length) {
    return {
      ok: false,
      error: `Campos sincronizados não editáveis: ${forbidden.join(', ')}`,
    };
  }

  const allowed = ENRICHMENT_ALLOWED_KEYS[slug] || [];
  const unknown = keys.filter((key) => !allowed.includes(key));
  if (unknown.length) {
    return {
      ok: false,
      error: `Campos de enriquecimento inválidos: ${unknown.join(', ')}`,
    };
  }

  let fieldError = null;

  if (slug === 'hospitalar' || slug === 'misto') {
    if (body.leitos !== undefined) {
      fieldError = validateLeitos(body.leitos);
    }
    if (!fieldError && body.especialidades !== undefined) {
      fieldError = validateStringArray(body.especialidades, 'especialidades');
    }
    if (!fieldError && body.habilitacoes !== undefined) {
      fieldError = validateStringArray(body.habilitacoes, 'habilitacoes');
    }
    if (!fieldError && slug === 'misto' && body.capacidades_ambulatoriais !== undefined) {
      fieldError = validateStringArray(
        body.capacidades_ambulatoriais,
        'capacidades_ambulatoriais'
      );
    }
  }

  if (!fieldError && slug === 'mac' && body.capacidades !== undefined) {
    fieldError = validateStringArray(body.capacidades, 'capacidades');
  }

  if (!fieldError && slug === 'aps') {
    for (const field of ENRICHMENT_ALLOWED_KEYS.aps) {
      const maxLen = field === 'cobertura_populacional' ? 200 : 2000;
      fieldError = validateOptionalString(body[field], field, maxLen);
      if (fieldError) break;
    }
  }

  if (!fieldError) {
    for (const field of ['notas', 'capacidade_notas', 'notas_mac', 'relacionamento_referencia', 'autorizacoes']) {
      if (body[field] !== undefined) {
        fieldError = validateOptionalString(body[field], field, 2000);
        if (fieldError) break;
      }
    }
  }

  if (fieldError) {
    return { ok: false, error: fieldError };
  }

  return { ok: true };
}

function validateEnrichmentPayload(body) {
  return validateEnrichmentForSlug('hospitalar', body);
}

function mergeScalarField(current, body, key) {
  if (!(key in body)) {
    return current[key];
  }
  const value = body[key];
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  return value;
}

function mergeArrayField(current, body, key) {
  if (!(key in body)) {
    return current[key];
  }
  if (!body[key]?.length) {
    return undefined;
  }
  return body[key];
}

function mergeLeitosField(current, body) {
  if (!('leitos' in body)) {
    return current.leitos;
  }
  if (!body.leitos || Object.keys(body.leitos).length === 0) {
    return undefined;
  }
  return body.leitos;
}

function mergeEnrichmentForSlug(slug, current, body) {
  const merged = { ...current };

  if (slug === 'hospitalar') {
    merged.leitos = mergeLeitosField(current, body);
    merged.especialidades = mergeArrayField(current, body, 'especialidades');
    merged.habilitacoes = mergeArrayField(current, body, 'habilitacoes');
    merged.capacidade_notas = mergeScalarField(current, body, 'capacidade_notas');
    merged.notas = mergeScalarField(current, body, 'notas');
  } else if (slug === 'misto') {
    merged.leitos = mergeLeitosField(current, body);
    merged.capacidades_ambulatoriais = mergeArrayField(
      current,
      body,
      'capacidades_ambulatoriais'
    );
    merged.notas_mac = mergeScalarField(current, body, 'notas_mac');
    merged.notas = mergeScalarField(current, body, 'notas');
  } else if (slug === 'aps') {
    for (const key of ENRICHMENT_ALLOWED_KEYS.aps) {
      merged[key] = mergeScalarField(current, body, key);
    }
  } else if (slug === 'mac') {
    merged.capacidades = mergeArrayField(current, body, 'capacidades');
    merged.relacionamento_referencia = mergeScalarField(
      current,
      body,
      'relacionamento_referencia'
    );
    merged.autorizacoes = mergeScalarField(current, body, 'autorizacoes');
    merged.notas = mergeScalarField(current, body, 'notas');
  } else if (slug === 'outro') {
    merged.notas = mergeScalarField(current, body, 'notas');
  }

  Object.keys(merged).forEach((key) => {
    if (merged[key] === undefined) {
      delete merged[key];
    }
  });

  return merged;
}

function mergeEnrichment(current, body) {
  return mergeEnrichmentForSlug('hospitalar', current, body);
}

function mapEnrichmentFromJoin(row) {
  switch (row.perfil) {
    case 'APS':
      return {
        notas_territorio: row.notas_territorio ?? undefined,
        cobertura_populacional: row.cobertura_populacional ?? undefined,
        vinculo_esus: row.vinculo_esus ?? undefined,
        prioridades_planejamento: row.prioridades_planejamento ?? undefined,
        notas: row.aps_notas ?? undefined,
      };
    case 'MAC':
      return {
        capacidades: row.mac_capacidades ?? [],
        relacionamento_referencia: row.relacionamento_referencia ?? undefined,
        autorizacoes: row.autorizacoes ?? undefined,
        notas: row.mac_notas ?? undefined,
      };
    case 'Hospitalar':
      return {
        leitos: row.eh_leitos ?? {},
        especialidades: row.especialidades ?? [],
        habilitacoes: row.habilitacoes ?? [],
        capacidade_notas: row.capacidade_notas ?? undefined,
        notas: row.eh_notas ?? undefined,
      };
    case 'Misto':
      return {
        leitos: row.emi_leitos ?? {},
        capacidades_ambulatoriais: row.capacidades_ambulatoriais ?? [],
        notas_mac: row.notas_mac ?? undefined,
        notas: row.emi_notas ?? undefined,
      };
    case 'Outro':
      return {
        notas: row.outro_notas ?? undefined,
      };
    default:
      return {};
  }
}

function mapEstabelecimentoRow(row, { includeEnrichment = false } = {}) {
  const mapped = {
    id: row.id,
    codigo_externo: row.codigo_externo,
    nome: row.nome,
    cnpj: row.cnpj,
    re_tipo: row.re_tipo,
    tipouni: row.tipouni,
    perfil: row.perfil,
    perfil_editado: row.perfil_editado ?? false,
    area: row.area,
    relatorio: row.relatorio,
    status: row.status,
    sincronizado_em: row.sincronizado_em,
  };

  if (includeEnrichment) {
    mapped.enrichment = mapEnrichmentFromJoin(row);
  }

  return mapped;
}

async function fetchEstabelecimentoCore(id) {
  const { rows } = await query(
    `SELECT id, codigo_externo, nome, perfil, perfil_editado
     FROM estabelecimentos
     WHERE id = $1`,
    [id]
  );

  if (!rows.length) {
    throw createHttpError('Estabelecimento não encontrado', 404);
  }

  return rows[0];
}

async function fetchEnrichmentRow(id, slug) {
  const table = `enriquecimento_${slug}`;
  const { rows } = await query(`SELECT * FROM ${table} WHERE estabelecimento_id = $1`, [
    id,
  ]);
  return rows[0] || {};
}

function mapLegacyEnrichmentBody(body, slug) {
  if (slug !== 'misto') {
    return body;
  }

  const mapped = { ...body };
  if (mapped.especialidades && !mapped.capacidades_ambulatoriais) {
    mapped.capacidades_ambulatoriais = mapped.especialidades;
    delete mapped.especialidades;
  }
  if (mapped.habilitacoes) {
    delete mapped.habilitacoes;
  }
  return mapped;
}

async function persistEnrichment(id, slug, merged) {
  if (slug === 'hospitalar') {
    await query(
      `INSERT INTO enriquecimento_hospitalar (
         estabelecimento_id, leitos, especialidades, habilitacoes, capacidade_notas, notas, atualizado_em
       ) VALUES ($1, $2::jsonb, $3, $4, $5, $6, now())
       ON CONFLICT (estabelecimento_id) DO UPDATE SET
         leitos = EXCLUDED.leitos,
         especialidades = EXCLUDED.especialidades,
         habilitacoes = EXCLUDED.habilitacoes,
         capacidade_notas = EXCLUDED.capacidade_notas,
         notas = EXCLUDED.notas,
         atualizado_em = now()`,
      [
        id,
        JSON.stringify(merged.leitos || {}),
        merged.especialidades || [],
        merged.habilitacoes || [],
        merged.capacidade_notas ?? null,
        merged.notas ?? null,
      ]
    );
    return;
  }

  if (slug === 'misto') {
    await query(
      `INSERT INTO enriquecimento_misto (
         estabelecimento_id, leitos, capacidades_ambulatoriais, notas_mac, notas, atualizado_em
       ) VALUES ($1, $2::jsonb, $3, $4, $5, now())
       ON CONFLICT (estabelecimento_id) DO UPDATE SET
         leitos = EXCLUDED.leitos,
         capacidades_ambulatoriais = EXCLUDED.capacidades_ambulatoriais,
         notas_mac = EXCLUDED.notas_mac,
         notas = EXCLUDED.notas,
         atualizado_em = now()`,
      [
        id,
        JSON.stringify(merged.leitos || {}),
        merged.capacidades_ambulatoriais || [],
        merged.notas_mac ?? null,
        merged.notas ?? null,
      ]
    );
    return;
  }

  if (slug === 'aps') {
    await query(
      `INSERT INTO enriquecimento_aps (
         estabelecimento_id, notas_territorio, cobertura_populacional, vinculo_esus,
         prioridades_planejamento, notas, atualizado_em
       ) VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (estabelecimento_id) DO UPDATE SET
         notas_territorio = EXCLUDED.notas_territorio,
         cobertura_populacional = EXCLUDED.cobertura_populacional,
         vinculo_esus = EXCLUDED.vinculo_esus,
         prioridades_planejamento = EXCLUDED.prioridades_planejamento,
         notas = EXCLUDED.notas,
         atualizado_em = now()`,
      [
        id,
        merged.notas_territorio ?? null,
        merged.cobertura_populacional ?? null,
        merged.vinculo_esus ?? null,
        merged.prioridades_planejamento ?? null,
        merged.notas ?? null,
      ]
    );
    return;
  }

  if (slug === 'mac') {
    await query(
      `INSERT INTO enriquecimento_mac (
         estabelecimento_id, capacidades, relacionamento_referencia, autorizacoes, notas, atualizado_em
       ) VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (estabelecimento_id) DO UPDATE SET
         capacidades = EXCLUDED.capacidades,
         relacionamento_referencia = EXCLUDED.relacionamento_referencia,
         autorizacoes = EXCLUDED.autorizacoes,
         notas = EXCLUDED.notas,
         atualizado_em = now()`,
      [
        id,
        merged.capacidades || [],
        merged.relacionamento_referencia ?? null,
        merged.autorizacoes ?? null,
        merged.notas ?? null,
      ]
    );
    return;
  }

  if (slug === 'outro') {
    await query(
      `INSERT INTO enriquecimento_outro (estabelecimento_id, notas, atualizado_em)
       VALUES ($1, $2, now())
       ON CONFLICT (estabelecimento_id) DO UPDATE SET
         notas = EXCLUDED.notas,
         atualizado_em = now()`,
      [id, merged.notas ?? null]
    );
  }
}

async function listEstabelecimentos(queryParams = {}) {
  const perfil = queryParams.perfil || null;
  const status = queryParams.status || 'ativo';
  const q = queryParams.q ? `%${queryParams.q}%` : null;
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), 200);
  const offset = (page - 1) * limit;

  if (perfil && !VALID_PERFIS.includes(perfil)) {
    throw createHttpError('perfil inválido', 400);
  }

  const conditions = ['1=1'];
  const params = [];

  if (perfil) {
    params.push(perfil);
    conditions.push(`perfil = $${params.length}`);
  }

  if (status !== 'all') {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (q) {
    params.push(q);
    conditions.push(
      `(nome ILIKE $${params.length} OR codigo_externo ILIKE $${params.length})`
    );
  }

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM estabelecimentos WHERE ${where}`,
    params
  );
  const total = countResult.rows[0].total;

  params.push(limit, offset);
  const { rows } = await query(
    `SELECT id, codigo_externo, nome, cnpj, re_tipo, tipouni, perfil, perfil_editado,
            area, relatorio, status, sincronizado_em
     FROM estabelecimentos
     WHERE ${where}
     ORDER BY nome
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    data: rows.map((row) => mapEstabelecimentoRow(row)),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

async function getEstabelecimentoById(id) {
  const { rows } = await query(`${DETAIL_SELECT} WHERE e.id = $1`, [id]);

  if (!rows.length) {
    throw createHttpError('Estabelecimento não encontrado', 404);
  }

  return mapEstabelecimentoRow(rows[0], { includeEnrichment: true });
}

async function updatePerfil(id, perfil) {
  if (!VALID_PERFIS.includes(perfil)) {
    throw createHttpError('perfil inválido', 400);
  }

  const { rows } = await query(
    `UPDATE estabelecimentos
     SET perfil = $1, perfil_editado = true
     WHERE id = $2
     RETURNING id`,
    [perfil, id]
  );

  if (!rows.length) {
    throw createHttpError('Estabelecimento não encontrado', 404);
  }

  return getEstabelecimentoById(id);
}

async function upsertEnrichment(id, slug, body) {
  if (!VALID_SLUGS.includes(slug)) {
    throw createHttpError('slug de enriquecimento inválido', 400);
  }

  const validation = validateEnrichmentForSlug(slug, body);
  if (!validation.ok) {
    throw createHttpError(validation.error, 400);
  }

  const estab = await fetchEstabelecimentoCore(id);
  const expectedSlug = PERFIL_TO_SLUG[estab.perfil];

  if (expectedSlug !== slug) {
    throw createHttpError(
      'Slug de enriquecimento não corresponde ao perfil do estabelecimento',
      403
    );
  }

  const currentRow = await fetchEnrichmentRow(id, slug);
  const current = mapEnrichmentFromJoin({
    perfil: estab.perfil,
    ...currentRow,
    eh_leitos: currentRow.leitos,
    eh_notas: currentRow.notas,
    emi_leitos: currentRow.leitos,
    emi_notas: currentRow.notas,
    aps_notas: currentRow.notas,
    mac_notas: currentRow.notas,
    mac_capacidades: currentRow.capacidades,
    outro_notas: currentRow.notas,
  });

  const merged = mergeEnrichmentForSlug(slug, current, body);
  await persistEnrichment(id, slug, merged);

  return getEstabelecimentoById(id);
}

async function updateEnriquecimento(id, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createHttpError('Corpo deve ser um objeto JSON de enriquecimento', 400);
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    throw createHttpError('Nenhum campo de enriquecimento informado', 400);
  }

  const forbidden = keys.filter((key) => FORBIDDEN_IDENTITY_KEYS.includes(key));
  if (forbidden.length) {
    throw createHttpError(
      `Campos sincronizados não editáveis: ${forbidden.join(', ')}`,
      400
    );
  }

  const estab = await fetchEstabelecimentoCore(id);
  const slug = PERFIL_TO_SLUG[estab.perfil];

  if (!['hospitalar', 'misto'].includes(slug)) {
    throw createHttpError(
      'Enriquecimento disponível apenas para perfis Hospitalar ou Misto',
      403
    );
  }

  const legacyKeys = Object.keys(body);
  const hasLegacyShape = legacyKeys.some((key) => LEGACY_ENRICHMENT_KEYS.includes(key));
  const normalizedBody = hasLegacyShape
    ? mapLegacyEnrichmentBody(body, slug)
    : body;

  return upsertEnrichment(id, slug, normalizedBody);
}

module.exports = {
  VALID_PERFIS,
  VALID_SLUGS,
  PERFIL_TO_SLUG,
  ENRICHMENT_ALLOWED_KEYS,
  LEGACY_ENRICHMENT_KEYS,
  FORBIDDEN_IDENTITY_KEYS,
  mergeEnrichment,
  mergeEnrichmentForSlug,
  validateEnrichmentPayload,
  validateEnrichmentForSlug,
  listEstabelecimentos,
  getEstabelecimentoById,
  updatePerfil,
  upsertEnrichment,
  updateEnriquecimento,
  mapEstabelecimentoRow,
  mapEnrichmentFromJoin,
};
