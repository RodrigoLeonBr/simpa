const { query } = require('./db');

async function listGrupos() {
  const { rows } = await query(
    'SELECT id, nome, slug, ordem, ativo FROM vacina_grupos ORDER BY ordem, nome',
    [],
  );
  return rows;
}

async function createGrupo({ nome, slug, ordem = 0 }) {
  const { rows } = await query(
    'INSERT INTO vacina_grupos (nome, slug, ordem) VALUES ($1, $2, $3) RETURNING *',
    [nome, slug, ordem],
  );
  return rows[0];
}

async function updateGrupo(id, { nome, slug, ordem, ativo }) {
  const { rows } = await query(
    `UPDATE vacina_grupos
     SET nome  = COALESCE($2, nome),
         slug  = COALESCE($3, slug),
         ordem = COALESCE($4, ordem),
         ativo = COALESCE($5, ativo)
     WHERE id = $1
     RETURNING *`,
    [id, nome ?? null, slug ?? null, ordem ?? null, ativo ?? null],
  );
  return rows[0];
}

async function listFaixaGrupo() {
  const { rows } = await query(
    `SELECT fg.faixa_nies, fg.grupo_id, g.nome AS grupo_nome
     FROM vacina_faixa_grupo fg
     LEFT JOIN vacina_grupos g ON g.id = fg.grupo_id
     ORDER BY fg.faixa_nies`,
    [],
  );
  return rows;
}

async function setFaixaGrupo(faixa, grupoId) {
  const { rows } = await query(
    'UPDATE vacina_faixa_grupo SET grupo_id=$2 WHERE faixa_nies=$1 RETURNING *',
    [faixa, grupoId],
  );
  return rows[0];
}

async function listPopulacao(ano) {
  const { rows } = await query(
    `SELECT p.id, p.ano, p.grupo_id, g.nome AS grupo_nome, p.populacao
     FROM vacina_populacao_alvo p
     JOIN vacina_grupos g ON g.id = p.grupo_id
     WHERE ($1::int IS NULL OR p.ano = $1)
     ORDER BY p.ano DESC, g.nome`,
    [ano ?? null],
  );
  return rows;
}

async function upsertPopulacao({ ano, grupo_id, populacao }) {
  const { rows } = await query(
    `INSERT INTO vacina_populacao_alvo (ano, grupo_id, populacao)
     VALUES ($1, $2, $3)
     ON CONFLICT (ano, grupo_id) DO UPDATE SET populacao = EXCLUDED.populacao
     RETURNING *`,
    [ano, grupo_id, populacao],
  );
  return rows[0];
}

async function listEsquema() {
  const { rows } = await query(
    `SELECT e.id, e.imuno_codigo,
            COALESCE(i.imuno_nome, e.imuno_codigo) AS imuno_nome,
            e.grupo_id, g.nome AS grupo_nome, e.num_doses
     FROM vacina_esquema e
     JOIN vacina_grupos g ON g.id = e.grupo_id
     LEFT JOIN vacina_imunobiologicos i ON i.imuno_codigo = e.imuno_codigo
     ORDER BY imuno_nome, g.nome`,
    [],
  );
  return rows;
}

async function upsertEsquema({ imuno_codigo, grupo_id, num_doses }) {
  const { rows } = await query(
    `INSERT INTO vacina_esquema (imuno_codigo, grupo_id, num_doses)
     VALUES ($1, $2, $3)
     ON CONFLICT (imuno_codigo, grupo_id) DO UPDATE SET num_doses = EXCLUDED.num_doses
     RETURNING *`,
    [imuno_codigo, grupo_id, num_doses],
  );
  return rows[0];
}

async function deleteEsquema(id) {
  const { rows } = await query(
    'DELETE FROM vacina_esquema WHERE id=$1 RETURNING id',
    [id],
  );
  return rows[0];
}

async function listImunobiologicos() {
  const { rows } = await query(
    'SELECT imuno_codigo, imuno_nome FROM vacina_imunobiologicos ORDER BY imuno_nome',
    [],
  );
  return rows;
}

module.exports = {
  listGrupos,
  createGrupo,
  updateGrupo,
  listFaixaGrupo,
  setFaixaGrupo,
  listPopulacao,
  upsertPopulacao,
  listEsquema,
  upsertEsquema,
  deleteEsquema,
  listImunobiologicos,
};
