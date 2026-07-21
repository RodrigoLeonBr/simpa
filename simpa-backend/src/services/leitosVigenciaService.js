const { pool, query } = require('./db');
const {
  normalizeLeitosResumo,
  rangesOverlap,
  validateVigenciaPayload,
} = require('./leitosVigenciaValidation');

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function fetchPerfil(estabelecimentoId, execute = query) {
  const { rows } = await execute('SELECT perfil FROM estabelecimentos WHERE id = $1', [
    estabelecimentoId,
  ]);
  if (!rows.length) {
    throw createHttpError('Estabelecimento não encontrado', 404);
  }
  return rows[0].perfil;
}

async function assertVigenciaBelongsToEstabelecimento(
  estabelecimentoId,
  vigenciaId,
  execute = query
) {
  const { rows } = await execute(
    `SELECT id FROM enriquecimento_hospitalar_leitos_vigencia
     WHERE id = $1 AND estabelecimento_id = $2`,
    [vigenciaId, estabelecimentoId]
  );
  if (!rows.length) {
    throw createHttpError('Vigência não encontrada', 404);
  }
}

async function assertNoOverlap(
  estabelecimentoId,
  vigenciaInicio,
  vigenciaFim,
  { excludeId, execute = query } = {}
) {
  const { rows } = await execute(
    `SELECT id, vigencia_inicio, vigencia_fim
     FROM enriquecimento_hospitalar_leitos_vigencia
     WHERE estabelecimento_id = $1`,
    [estabelecimentoId]
  );

  for (const vigencia of rows) {
    if (excludeId !== undefined && Number(vigencia.id) === Number(excludeId)) {
      continue;
    }
    if (
      rangesOverlap(
        vigenciaInicio,
        vigenciaFim,
        vigencia.vigencia_inicio,
        vigencia.vigencia_fim
      )
    ) {
      throw createHttpError(
        `Vigência sobrepõe período existente (${vigencia.vigencia_inicio}–${vigencia.vigencia_fim})`,
        400
      );
    }
  }
}

async function mirrorOpenVigenciaLeitos(estabelecimentoId, perfil, execute) {
  if (perfil !== 'Hospitalar' && perfil !== 'Misto') {
    return;
  }

  const table = perfil === 'Hospitalar' ? 'enriquecimento_hospitalar' : 'enriquecimento_misto';

  const { rows } = await execute(
    `SELECT leitos FROM enriquecimento_hospitalar_leitos_vigencia
     WHERE estabelecimento_id = $1 AND vigencia_fim = '999999'
     ORDER BY vigencia_inicio DESC LIMIT 1`,
    [estabelecimentoId]
  );

  const leitos = rows[0]?.leitos || {};

  await execute(
    `INSERT INTO ${table} (estabelecimento_id, leitos, atualizado_em)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (estabelecimento_id) DO UPDATE SET leitos = EXCLUDED.leitos, atualizado_em = now()`,
    [estabelecimentoId, JSON.stringify(leitos)]
  );
}

async function listLeitosVigencias(estabelecimentoId) {
  const { rows } = await query(
    `SELECT id, estabelecimento_id, vigencia_inicio, vigencia_fim, leitos, leitos_detalhe, atualizado_em
     FROM enriquecimento_hospitalar_leitos_vigencia
     WHERE estabelecimento_id = $1
     ORDER BY vigencia_inicio ASC`,
    [estabelecimentoId]
  );
  return rows;
}

async function createLeitosVigencia(estabelecimentoId, body) {
  const validation = validateVigenciaPayload(body);
  if (!validation.ok) {
    throw createHttpError(validation.error, 400);
  }

  const perfil = await fetchPerfil(estabelecimentoId);

  const leitos = normalizeLeitosResumo(body.leitos);
  const detalhe = body.leitos_detalhe || {};

  await assertNoOverlap(estabelecimentoId, body.vigencia_inicio, body.vigencia_fim);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO enriquecimento_hospitalar_leitos_vigencia
         (estabelecimento_id, vigencia_inicio, vigencia_fim, leitos, leitos_detalhe, atualizado_em)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, now())
       RETURNING *`,
      [
        estabelecimentoId,
        body.vigencia_inicio,
        body.vigencia_fim,
        JSON.stringify(leitos),
        JSON.stringify(detalhe),
      ]
    );

    await mirrorOpenVigenciaLeitos(estabelecimentoId, perfil, client.query.bind(client));

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateLeitosVigencia(estabelecimentoId, vigenciaId, body) {
  const validation = validateVigenciaPayload(body);
  if (!validation.ok) {
    throw createHttpError(validation.error, 400);
  }

  const perfil = await fetchPerfil(estabelecimentoId);
  await assertVigenciaBelongsToEstabelecimento(estabelecimentoId, vigenciaId);

  const leitos = normalizeLeitosResumo(body.leitos);
  const detalhe = body.leitos_detalhe || {};

  await assertNoOverlap(estabelecimentoId, body.vigencia_inicio, body.vigencia_fim, {
    excludeId: vigenciaId,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE enriquecimento_hospitalar_leitos_vigencia
       SET vigencia_inicio = $1, vigencia_fim = $2, leitos = $3::jsonb, leitos_detalhe = $4::jsonb, atualizado_em = now()
       WHERE id = $5
       RETURNING *`,
      [
        body.vigencia_inicio,
        body.vigencia_fim,
        JSON.stringify(leitos),
        JSON.stringify(detalhe),
        vigenciaId,
      ]
    );

    await mirrorOpenVigenciaLeitos(estabelecimentoId, perfil, client.query.bind(client));

    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deleteLeitosVigencia(estabelecimentoId, vigenciaId) {
  const perfil = await fetchPerfil(estabelecimentoId);
  await assertVigenciaBelongsToEstabelecimento(estabelecimentoId, vigenciaId);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'DELETE FROM enriquecimento_hospitalar_leitos_vigencia WHERE id = $1',
      [vigenciaId]
    );

    await mirrorOpenVigenciaLeitos(estabelecimentoId, perfil, client.query.bind(client));

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listLeitosVigencias,
  createLeitosVigencia,
  updateLeitosVigencia,
  deleteLeitosVigencia,
  mirrorOpenVigenciaLeitos,
};
