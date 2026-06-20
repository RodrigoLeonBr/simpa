const { query, pool } = require('./db');
const { assertActiveEstabelecimento } = require('./cadastrosService');

function competenciaDate(value) {
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{4}-\d{2}$/.test(str)) {
    return `${str}-01`;
  }
  return str;
}

function competenciaLabel(value) {
  return competenciaDate(value).slice(0, 7);
}

function isTodasEquipe(esusEquipeCodigo, esusEquipeNome) {
  const nome = String(esusEquipeNome || '').trim().toLowerCase();
  return !esusEquipeCodigo && (nome === 'todas' || nome === '');
}

function normalizeForSimilarity(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  const normalized = normalizeForSimilarity(text);
  if (!normalized) {
    return [];
  }
  return normalized.split(' ').filter(Boolean);
}

function scoreNameSimilarity(label, candidateName) {
  const labelTokens = tokenize(label);
  const candidateTokens = tokenize(candidateName);

  if (!labelTokens.length || !candidateTokens.length) {
    return 0;
  }

  const labelSet = new Set(labelTokens);
  const candidateSet = new Set(candidateTokens);
  let overlap = 0;
  for (const token of labelSet) {
    if (candidateSet.has(token)) {
      overlap += 1;
    }
  }

  const union = new Set([...labelSet, ...candidateSet]).size;
  let score = union > 0 ? overlap / union : 0;

  const firstLabel = labelTokens[0];
  const firstCandidate = candidateTokens[0];
  if (
    firstLabel &&
    firstCandidate &&
    (firstCandidate.startsWith(firstLabel) || firstLabel.startsWith(firstCandidate))
  ) {
    score += 0.25;
  }

  return Math.min(score, 1);
}

async function suggestEstabelecimentos(esusUnidadeLabel, { limit = 5 } = {}) {
  const { rows } = await query(
    `SELECT id, codigo_externo, nome
     FROM estabelecimentos
     WHERE status = 'ativo'
     ORDER BY nome`
  );

  return rows
    .map((row) => ({
      id: row.id,
      codigo_externo: row.codigo_externo,
      nome: row.nome,
      score: scoreNameSimilarity(esusUnidadeLabel, row.nome),
    }))
    .sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome))
    .slice(0, limit);
}

async function lookupMapeamentoUnidade(esusUnidadeLabel) {
  const { rows } = await query(
    `SELECT id, estabelecimento_id, equipe_id
     FROM esus_import_mapeamentos
     WHERE status = 'ativo'
       AND esus_unidade_label = $1
       AND esus_equipe_codigo IS NULL
       AND esus_equipe_nome IS NULL
     LIMIT 1`,
    [esusUnidadeLabel]
  );
  return rows[0] || null;
}

async function lookupMapeamentoEquipe(estabelecimentoId, esusEquipeCodigo, esusEquipeNome) {
  if (isTodasEquipe(esusEquipeCodigo, esusEquipeNome)) {
    const codigo = `TODAS-${estabelecimentoId}`;
    const { rows } = await query(
      `SELECT id FROM equipes
       WHERE codigo = $1 AND estabelecimento_id = $2 AND status != 'inativo'
       LIMIT 1`,
      [codigo, estabelecimentoId]
    );
    if (rows.length) {
      return { equipe_id: rows[0].id, from_registry: false };
    }
    return null;
  }

  if (esusEquipeCodigo) {
    const { rows } = await query(
      `SELECT id, equipe_id
       FROM esus_import_mapeamentos
       WHERE status = 'ativo'
         AND estabelecimento_id = $1
         AND esus_equipe_codigo = $2
       LIMIT 1`,
      [estabelecimentoId, esusEquipeCodigo]
    );
    if (rows.length) {
      return { equipe_id: rows[0].equipe_id, from_registry: true, mapeamento_id: rows[0].id };
    }
  }

  if (esusEquipeNome) {
    const { rows } = await query(
      `SELECT id, equipe_id
       FROM esus_import_mapeamentos
       WHERE status = 'ativo'
         AND estabelecimento_id = $1
         AND esus_equipe_nome = $2
         AND esus_equipe_codigo IS NULL
       LIMIT 1`,
      [estabelecimentoId, esusEquipeNome]
    );
    if (rows.length) {
      return { equipe_id: rows[0].equipe_id, from_registry: true, mapeamento_id: rows[0].id };
    }
  }

  return null;
}

async function getEstabelecimentoBasico(estabelecimentoId) {
  const { rows } = await query(
    `SELECT id, codigo_externo, nome FROM estabelecimentos WHERE id = $1 AND status = 'ativo'`,
    [estabelecimentoId]
  );
  return rows[0] || null;
}

async function getEquipeBasica(equipeId) {
  const { rows } = await query(
    `SELECT id, codigo, nome FROM equipes WHERE id = $1 AND status != 'inativo'`,
    [equipeId]
  );
  return rows[0] || null;
}

async function ensureEquipe({ estabelecimentoId, esusEquipeCodigo, esusEquipeNome }) {
  await assertActiveEstabelecimento(estabelecimentoId);

  if (isTodasEquipe(esusEquipeCodigo, esusEquipeNome)) {
    const codigo = `TODAS-${estabelecimentoId}`;
    const existing = await query(
      `SELECT id, codigo, nome FROM equipes
       WHERE codigo = $1 AND estabelecimento_id = $2 AND status != 'inativo'
       LIMIT 1`,
      [codigo, estabelecimentoId]
    );
    if (existing.rows.length) {
      return existing.rows[0];
    }

    const inserted = await query(
      `INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
       VALUES ($1, 'Todas', 'Outra', $2, 'ativo')
       RETURNING id, codigo, nome`,
      [codigo, estabelecimentoId]
    );
    return inserted.rows[0];
  }

  const codigo = String(esusEquipeCodigo || '').trim();
  if (!codigo) {
    const error = new Error('equipe_codigo é obrigatório para equipes específicas');
    error.status = 400;
    throw error;
  }

  const nome = String(esusEquipeNome || codigo).trim();

  const existing = await query(
    `SELECT id, codigo, nome FROM equipes
     WHERE codigo = $1 AND estabelecimento_id = $2 AND status != 'inativo'
     LIMIT 1`,
    [codigo, estabelecimentoId]
  );
  if (existing.rows.length) {
    return existing.rows[0];
  }

  const inserted = await query(
    `INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
     VALUES ($1, $2, 'Outra', $3, 'ativo')
     RETURNING id, codigo, nome`,
    [codigo, nome, estabelecimentoId]
  );
  return inserted.rows[0];
}

async function detectTodasConflict({ estabelecimentoId, competencia, esusEquipeNome }) {
  const comp = competenciaDate(competencia);
  const incomingTodas = isTodasEquipe(null, esusEquipeNome);

  if (incomingTodas) {
    const { rows } = await query(
      `SELECT c.id
       FROM esus_cargas c
       JOIN equipes e ON e.id = c.equipe_id
       WHERE c.estabelecimento_id = $1
         AND c.competencia = $2
         AND e.nome <> 'Todas'`,
      [estabelecimentoId, comp]
    );
    return {
      exists: rows.length > 0,
      cargas_ids: rows.map((r) => r.id),
      requires_confirm: false,
    };
  }

  const { rows } = await query(
    `SELECT c.id
     FROM esus_cargas c
     JOIN equipes e ON e.id = c.equipe_id
     WHERE c.estabelecimento_id = $1
       AND c.competencia = $2
       AND e.nome = 'Todas'`,
    [estabelecimentoId, comp]
  );

  return {
    exists: rows.length > 0,
    cargas_ids: rows.map((r) => r.id),
    requires_confirm: true,
  };
}

async function purgeTodasImports({ estabelecimentoId, competencia }, client) {
  const runQuery = client ? client.query.bind(client) : query;
  const comp = competenciaDate(competencia);
  const codigo = `TODAS-${estabelecimentoId}`;

  const equipeResult = await runQuery(
    `SELECT id FROM equipes WHERE codigo = $1 AND estabelecimento_id = $2 LIMIT 1`,
    [codigo, estabelecimentoId]
  );
  const equipeId = equipeResult.rows[0]?.id;
  if (!equipeId) {
    return { cargas_ids: [], consolidado_removido: false };
  }

  const deletedCargas = await runQuery(
    `DELETE FROM esus_cargas
     WHERE estabelecimento_id = $1 AND competencia = $2 AND equipe_id = $3
     RETURNING id`,
    [estabelecimentoId, comp, equipeId]
  );

  const deletedConsolidado = await runQuery(
    `DELETE FROM dados_consolidados
     WHERE estabelecimento_id = $1 AND competencia = $2 AND equipe_id = $3
     RETURNING id`,
    [estabelecimentoId, comp, equipeId]
  );

  return {
    cargas_ids: deletedCargas.rows.map((r) => r.id),
    consolidado_removido: deletedConsolidado.rows.length > 0,
  };
}

async function checkJaImportado(meta, estabelecimentoId, equipeId) {
  if (estabelecimentoId && equipeId) {
    const { rows } = await query(
      `SELECT id FROM esus_cargas
       WHERE tipo_relatorio = $1
         AND competencia = $2
         AND estabelecimento_id = $3
         AND equipe_id = $4
       LIMIT 1`,
      [
        meta.tipo_relatorio,
        competenciaDate(meta.competencia),
        estabelecimentoId,
        equipeId,
      ]
    );
    return rows.length > 0;
  }

  const { rows } = await query(
    `SELECT id FROM esus_cargas
     WHERE tipo_relatorio = $1
       AND competencia = $2
       AND unidade = $3
       AND equipe_nome = $4
     LIMIT 1`,
    [
      meta.tipo_relatorio,
      competenciaDate(meta.competencia),
      meta.unidade,
      meta.equipe_nome,
    ]
  );
  return rows.length > 0;
}

async function enrichPreviewItem(meta, { userId } = {}) {
  const esusUnidade = meta.unidade || meta.esus_unidade || '';
  const esusEquipeNome = meta.equipe_nome || meta.esus_equipe_nome || 'Todas';
  const esusEquipeCodigo = meta.equipe_codigo ?? meta.esus_equipe_codigo ?? null;

  const unitMapping = await lookupMapeamentoUnidade(esusUnidade);

  const base = {
    nome: meta.nome || meta.arquivo_origem,
    tipo_relatorio: meta.tipo_relatorio,
    competencia: competenciaLabel(meta.competencia),
    esus_unidade: esusUnidade,
    esus_equipe_nome: esusEquipeNome,
    esus_equipe_codigo: esusEquipeCodigo,
  };

  if (!unitMapping) {
    const sugestoes = await suggestEstabelecimentos(esusUnidade);
    return {
      ...base,
      mapeamento_status: 'pending',
      sugestoes_estabelecimento: sugestoes,
      ja_importado: await checkJaImportado(meta, null, null),
    };
  }

  const estabelecimento = await getEstabelecimentoBasico(unitMapping.estabelecimento_id);
  if (!estabelecimento) {
    const sugestoes = await suggestEstabelecimentos(esusUnidade);
    return {
      ...base,
      mapeamento_status: 'pending',
      sugestoes_estabelecimento: sugestoes,
      ja_importado: await checkJaImportado(meta, null, null),
    };
  }

  const teamMapping = await lookupMapeamentoEquipe(
    estabelecimento.id,
    esusEquipeCodigo,
    esusEquipeNome
  );

  let equipeId = teamMapping?.equipe_id || unitMapping.equipe_id || null;
  let equipe = equipeId ? await getEquipeBasica(equipeId) : null;

  const conflitoTodas = await detectTodasConflict({
    estabelecimentoId: estabelecimento.id,
    competencia: meta.competencia,
    esusEquipeNome,
  });

  if (conflitoTodas.exists) {
    return {
      ...base,
      mapeamento_status: 'blocked',
      estabelecimento_id: estabelecimento.id,
      estabelecimento_codigo: estabelecimento.codigo_externo,
      estabelecimento_nome: estabelecimento.nome,
      equipe_id: equipe?.id,
      equipe_nome: equipe?.nome,
      conflito_todas: conflitoTodas,
      ja_importado: await checkJaImportado(meta, estabelecimento.id, equipe?.id),
    };
  }

  const hasTeamResolution =
    teamMapping?.from_registry ||
    isTodasEquipe(esusEquipeCodigo, esusEquipeNome) ||
    Boolean(String(esusEquipeCodigo || '').trim());

  const mapeamentoStatus = hasTeamResolution ? 'resolved' : 'pending';

  const result = {
    ...base,
    mapeamento_status: mapeamentoStatus,
    estabelecimento_id: estabelecimento.id,
    estabelecimento_codigo: estabelecimento.codigo_externo,
    estabelecimento_nome: estabelecimento.nome,
    ja_importado: await checkJaImportado(meta, estabelecimento.id, equipe?.id),
  };

  if (equipe) {
    result.equipe_id = equipe.id;
    result.equipe_nome = equipe.nome;
  }

  if (mapeamentoStatus === 'pending') {
    result.sugestoes_estabelecimento = await suggestEstabelecimentos(esusUnidade);
  }

  void userId;
  return result;
}

async function touchMapeamentosForMeta(meta, estabelecimentoId, client) {
  const runQuery = client ? client.query.bind(client) : query;
  const esusUnidade = meta.unidade || meta.esus_unidade || '';
  const esusEquipeCodigo = meta.equipe_codigo ?? meta.esus_equipe_codigo ?? null;
  const esusEquipeNome = meta.equipe_nome || meta.esus_equipe_nome || 'Todas';
  const teamNome = isTodasEquipe(esusEquipeCodigo, esusEquipeNome) ? null : esusEquipeNome;

  await runQuery(
    `UPDATE esus_import_mapeamentos
     SET ultimo_uso_em = now(), atualizado_em = now()
     WHERE status = 'ativo'
       AND (
         (esus_unidade_label = $1 AND esus_equipe_codigo IS NULL AND esus_equipe_nome IS NULL)
         OR ($3 IS NOT NULL AND estabelecimento_id = $2 AND esus_equipe_codigo = $3)
         OR ($4 IS NOT NULL AND estabelecimento_id = $2 AND esus_equipe_nome = $4 AND esus_equipe_codigo IS NULL)
       )`,
    [esusUnidade, estabelecimentoId, esusEquipeCodigo, teamNome]
  );
}

async function resolveForUpload(meta, resolucao, user) {
  const estabelecimentoId = resolucao.estabelecimento_id;
  if (!estabelecimentoId) {
    const error = new Error('estabelecimento_id é obrigatório');
    error.status = 400;
    throw error;
  }

  await assertActiveEstabelecimento(estabelecimentoId);

  const esusEquipeNome = meta.equipe_nome || meta.esus_equipe_nome || 'Todas';
  const esusEquipeCodigo = meta.equipe_codigo ?? meta.esus_equipe_codigo ?? null;

  const conflito = await detectTodasConflict({
    estabelecimentoId,
    competencia: meta.competencia,
    esusEquipeNome,
  });

  if (conflito.exists) {
    if (isTodasEquipe(esusEquipeCodigo, esusEquipeNome)) {
      const error = new Error(
        'Importação "Todas" bloqueada: já existem cargas de equipes específicas neste mês'
      );
      error.status = 409;
      throw error;
    }
    if (!resolucao.confirmar_remocao_todas) {
      const error = new Error(
        'Conflito "Todas": confirme a remoção das importações agregadas'
      );
      error.status = 409;
      error.conflito_todas = conflito;
      throw error;
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (conflito.exists && conflito.requires_confirm && resolucao.confirmar_remocao_todas) {
      await purgeTodasImports({ estabelecimentoId, competencia: meta.competencia }, client);
    }

    const equipe = await ensureEquipeWithClient(
      { estabelecimentoId, esusEquipeCodigo, esusEquipeNome },
      client
    );

    if (resolucao.salvar_mapeamento && user?.id) {
      await upsertMapeamentoWithClient(
        {
          esus_unidade_label: meta.unidade || meta.esus_unidade,
          esus_equipe_codigo: esusEquipeCodigo,
          esus_equipe_nome: isTodasEquipe(esusEquipeCodigo, esusEquipeNome)
            ? null
            : esusEquipeNome,
          estabelecimento_id: estabelecimentoId,
          equipe_id: equipe.id,
        },
        user,
        client
      );
    }

    await touchMapeamentosForMeta(meta, estabelecimentoId, client);

    const estabelecimento = await getEstabelecimentoBasico(estabelecimentoId);

    await client.query('COMMIT');

    return {
      estabelecimentoId,
      equipeId: equipe.id,
      estabelecimentoNome: estabelecimento?.nome || '',
      equipeNome: equipe.nome,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function ensureEquipeWithClient(params, client) {
  await assertActiveEstabelecimento(params.estabelecimentoId);

  if (isTodasEquipe(params.esusEquipeCodigo, params.esusEquipeNome)) {
    const codigo = `TODAS-${params.estabelecimentoId}`;
    const existing = await client.query(
      `SELECT id, codigo, nome FROM equipes
       WHERE codigo = $1 AND estabelecimento_id = $2 AND status != 'inativo'
       LIMIT 1`,
      [codigo, params.estabelecimentoId]
    );
    if (existing.rows.length) {
      return existing.rows[0];
    }
    const inserted = await client.query(
      `INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
       VALUES ($1, 'Todas', 'Outra', $2, 'ativo')
       RETURNING id, codigo, nome`,
      [codigo, params.estabelecimentoId]
    );
    return inserted.rows[0];
  }

  const codigo = String(params.esusEquipeCodigo || '').trim();
  if (!codigo) {
    const error = new Error('equipe_codigo é obrigatório para equipes específicas');
    error.status = 400;
    throw error;
  }

  const nome = String(params.esusEquipeNome || codigo).trim();
  const existing = await client.query(
    `SELECT id, codigo, nome FROM equipes
     WHERE codigo = $1 AND estabelecimento_id = $2 AND status != 'inativo'
     LIMIT 1`,
    [codigo, params.estabelecimentoId]
  );
  if (existing.rows.length) {
    return existing.rows[0];
  }
  const inserted = await client.query(
    `INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
     VALUES ($1, $2, 'Outra', $3, 'ativo')
     RETURNING id, codigo, nome`,
    [codigo, nome, params.estabelecimentoId]
  );
  return inserted.rows[0];
}

async function listMapeamentos(queryParams = {}) {
  const q = queryParams.q ? `%${queryParams.q}%` : null;
  const page = Math.max(parseInt(queryParams.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(queryParams.limit, 10) || 50, 1), 200);
  const offset = (page - 1) * limit;

  const conditions = ["m.status = 'ativo'"];
  const params = [];

  if (q) {
    params.push(q);
    conditions.push(
      `(m.esus_unidade_label ILIKE $${params.length}
        OR m.esus_equipe_nome ILIKE $${params.length}
        OR est.nome ILIKE $${params.length})`
    );
  }

  const where = conditions.join(' AND ');

  const countResult = await query(
    `SELECT COUNT(*)::int AS total
     FROM esus_import_mapeamentos m
     JOIN estabelecimentos est ON est.id = m.estabelecimento_id
     WHERE ${where}`,
    params
  );

  const listParams = [...params, limit, offset];
  const { rows } = await query(
    `SELECT m.id, m.esus_unidade_label, m.esus_equipe_codigo, m.esus_equipe_nome,
            m.estabelecimento_id, m.equipe_id, m.status, m.ultimo_uso_em,
            est.nome AS estabelecimento_nome, est.codigo_externo AS estabelecimento_codigo,
            eq.nome AS equipe_nome
     FROM esus_import_mapeamentos m
     JOIN estabelecimentos est ON est.id = m.estabelecimento_id
     LEFT JOIN equipes eq ON eq.id = m.equipe_id
     WHERE ${where}
     ORDER BY m.esus_unidade_label, m.esus_equipe_codigo NULLS FIRST
     LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
    listParams
  );

  return {
    data: rows,
    pagination: {
      page,
      limit,
      total: countResult.rows[0].total,
      pages: Math.ceil(countResult.rows[0].total / limit) || 1,
    },
  };
}

async function upsertMapeamentoWithClient(body, user, client) {
  const runQuery = client ? client.query.bind(client) : query;
  await assertActiveEstabelecimento(body.estabelecimento_id);

  const hasEquipe = Boolean(body.esus_equipe_codigo || body.esus_equipe_nome);

  if (!hasEquipe) {
    const existing = await runQuery(
      `SELECT id FROM esus_import_mapeamentos
       WHERE status = 'ativo'
         AND esus_unidade_label = $1
         AND esus_equipe_codigo IS NULL
         AND esus_equipe_nome IS NULL`,
      [body.esus_unidade_label]
    );

    if (existing.rows.length) {
      const { rows } = await runQuery(
        `UPDATE esus_import_mapeamentos
         SET estabelecimento_id = $1, equipe_id = $2, atualizado_por = $3, atualizado_em = now()
         WHERE id = $4
         RETURNING *`,
        [body.estabelecimento_id, body.equipe_id || null, user?.id || null, existing.rows[0].id]
      );
      return rows[0];
    }

    const { rows } = await runQuery(
      `INSERT INTO esus_import_mapeamentos
         (esus_unidade_label, estabelecimento_id, equipe_id, criado_por, atualizado_por)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING *`,
      [
        body.esus_unidade_label,
        body.estabelecimento_id,
        body.equipe_id || null,
        user?.id || null,
      ]
    );
    return rows[0];
  }

  const existing = await runQuery(
    `SELECT id FROM esus_import_mapeamentos
     WHERE status = 'ativo'
       AND estabelecimento_id = $1
       AND esus_equipe_codigo = $2`,
    [body.estabelecimento_id, body.esus_equipe_codigo]
  );

  if (existing.rows.length) {
    const { rows } = await runQuery(
      `UPDATE esus_import_mapeamentos
       SET equipe_id = $1, esus_equipe_nome = $2, atualizado_por = $3, atualizado_em = now()
       WHERE id = $4
       RETURNING *`,
      [
        body.equipe_id,
        body.esus_equipe_nome || null,
        user?.id || null,
        existing.rows[0].id,
      ]
    );
    return rows[0];
  }

  const { rows } = await runQuery(
    `INSERT INTO esus_import_mapeamentos
       (esus_unidade_label, esus_equipe_codigo, esus_equipe_nome,
        estabelecimento_id, equipe_id, criado_por, atualizado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING *`,
    [
      body.esus_unidade_label,
      body.esus_equipe_codigo || null,
      body.esus_equipe_nome || null,
      body.estabelecimento_id,
      body.equipe_id,
      user?.id || null,
    ]
  );
  return rows[0];
}

async function upsertMapeamento(body, user) {
  return upsertMapeamentoWithClient(body, user, null);
}

async function deactivateMapeamento(id, user) {
  const { rows } = await query(
    `UPDATE esus_import_mapeamentos
     SET status = 'inativo', atualizado_por = $2, atualizado_em = now()
     WHERE id = $1 AND status = 'ativo'
     RETURNING id`,
    [id, user?.id || null]
  );

  if (!rows.length) {
    const error = new Error('Mapeamento não encontrado');
    error.status = 404;
    throw error;
  }

  return { inativado: true, id: rows[0].id };
}

module.exports = {
  competenciaDate,
  competenciaLabel,
  isTodasEquipe,
  normalizeForSimilarity,
  tokenize,
  scoreNameSimilarity,
  suggestEstabelecimentos,
  lookupMapeamentoUnidade,
  lookupMapeamentoEquipe,
  ensureEquipe,
  detectTodasConflict,
  purgeTodasImports,
  enrichPreviewItem,
  resolveForUpload,
  listMapeamentos,
  upsertMapeamento,
  deactivateMapeamento,
};
