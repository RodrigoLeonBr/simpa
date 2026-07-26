const express = require('express');
const { query } = require('../services/db');

const router = express.Router();

router.get('/unidades', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, codigo, nome, tipo, cnes, status
       FROM unidades_saude WHERE status != 'inativo' ORDER BY nome`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/unidades', async (req, res, next) => {
  try {
    const { codigo, nome, tipo, cnes } = req.body;
    if (!codigo || !nome) {
      return res.status(400).json({ error: 'codigo e nome são obrigatórios' });
    }
    const { rows } = await query(
      `INSERT INTO unidades_saude (codigo, nome, tipo, cnes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [codigo, nome, tipo || null, cnes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/unidades/:id', async (req, res, next) => {
  try {
    const { nome, tipo, cnes, status } = req.body;
    const { rows } = await query(
      `UPDATE unidades_saude SET nome=$1, tipo=$2, cnes=$3, status=$4
       WHERE id=$5 RETURNING *`,
      [nome, tipo, cnes, status || 'ativo', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Unidade não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/unidades/:id', async (req, res, next) => {
  try {
    await query(
      `UPDATE unidades_saude SET status='inativo' WHERE id=$1`,
      [req.params.id]
    );
    res.json({ inativado: true, id: parseInt(req.params.id) });
  } catch (err) { next(err); }
});

router.get('/equipes', async (req, res, next) => {
  try {
    const { unidade_id } = req.query;
    const params = [];
    const conditions = ["e.status != 'inativo'"];
    if (unidade_id) {
      params.push(unidade_id);
      conditions.push(`e.unidade_id = $${params.length}`);
    }
    const { rows } = await query(
      `SELECT e.id, e.codigo, e.nome, e.tipo, e.status,
              u.nome AS unidade_nome
       FROM equipes e
       LEFT JOIN unidades_saude u ON u.id = e.unidade_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.nome`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/equipes', async (req, res, next) => {
  try {
    const { codigo, nome, tipo, unidade_id } = req.body;
    if (!codigo || !nome) {
      return res.status(400).json({ error: 'codigo e nome são obrigatórios' });
    }
    const { rows } = await query(
      `INSERT INTO equipes (codigo, nome, tipo, unidade_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [codigo, nome, tipo || null, unidade_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/equipes/:id', async (req, res, next) => {
  try {
    const { nome, tipo, unidade_id, status } = req.body;
    const { rows } = await query(
      `UPDATE equipes SET nome=$1, tipo=$2, unidade_id=$3, status=$4
       WHERE id=$5 RETURNING *`,
      [nome, tipo, unidade_id, status || 'ativo', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Equipe não encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/equipes/:id', async (req, res, next) => {
  try {
    await query(`UPDATE equipes SET status='inativo' WHERE id=$1`, [req.params.id]);
    res.json({ inativado: true, id: parseInt(req.params.id) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// procedimentos (mestre SIGTAP)
// ---------------------------------------------------------------------------

const MAP_SELECT = `
  SELECT m.id, m.secao, m.descricao_esus, m.procedimento_id, m.origem, m.status,
         p.codigo_sigtap, p.descricao AS descricao_sigtap
  FROM esus_procedimento_map m
  JOIN procedimentos p ON p.id = m.procedimento_id
`;

async function resolveProcedimentoId({ procedimento_id, codigo_sigtap, descricao }) {
  if (procedimento_id) {
    const { rows } = await query(
      `SELECT id FROM procedimentos WHERE id=$1`,
      [procedimento_id]
    );
    if (!rows.length) {
      const err = new Error('procedimento_id não encontrado');
      err.status = 400;
      throw err;
    }
    return rows[0].id;
  }
  if (!codigo_sigtap) {
    const err = new Error('procedimento_id ou codigo_sigtap é obrigatório');
    err.status = 400;
    throw err;
  }
  const code = String(codigo_sigtap).replace(/\D/g, '');
  const existing = await query(
    `SELECT id FROM procedimentos WHERE codigo_sigtap=$1`,
    [code]
  );
  if (existing.rows.length) return existing.rows[0].id;

  if (!descricao) {
    const err = new Error('descricao é obrigatória ao criar procedimento via codigo_sigtap');
    err.status = 400;
    throw err;
  }
  const inserted = await query(
    `INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
     VALUES ($1, $2, 'ambulatorial', 'SIGTAP', 'ativo', 'manual')
     RETURNING id`,
    [code, descricao]
  );
  return inserted.rows[0].id;
}

router.get('/procedimentos', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    const params = [];
    const conditions = [];
    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    } else {
      conditions.push(`status != 'inativo'`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(codigo_sigtap ILIKE $${params.length} OR descricao ILIKE $${params.length})`);
    }
    const { rows } = await query(
      `SELECT id, codigo_sigtap, descricao, tipo, tabela_referencia, status
       FROM procedimentos
       WHERE ${conditions.join(' AND ')}
       ORDER BY codigo_sigtap`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/procedimentos', async (req, res, next) => {
  try {
    const { codigo_sigtap, descricao, tipo, tabela_referencia } = req.body;
    if (!codigo_sigtap || !descricao) {
      return res.status(400).json({ error: 'codigo_sigtap e descricao são obrigatórios' });
    }
    const code = String(codigo_sigtap).replace(/\D/g, '');
    const { rows } = await query(
      `INSERT INTO procedimentos (codigo_sigtap, descricao, tipo, tabela_referencia, status, fonte)
       VALUES ($1, $2, $3, $4, 'ativo', 'manual')
       RETURNING id, codigo_sigtap, descricao, tipo, tabela_referencia, status`,
      [code, descricao, tipo || null, tabela_referencia || 'SIGTAP']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/procedimentos/:id', async (req, res, next) => {
  try {
    const { descricao, tipo, tabela_referencia, status } = req.body;
    const { rows } = await query(
      `UPDATE procedimentos
       SET descricao=$1, tipo=$2, tabela_referencia=$3, status=$4, atualizado_em=now()
       WHERE id=$5
       RETURNING id, codigo_sigtap, descricao, tipo, tabela_referencia, status`,
      [descricao, tipo || null, tabela_referencia || 'SIGTAP', status || 'ativo', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Procedimento não encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/procedimentos/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE procedimentos SET status='inativo', atualizado_em=now()
       WHERE id=$1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Procedimento não encontrado' });
    res.json({ inativado: true, id: parseInt(req.params.id, 10) });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// esus_procedimento_map (de-para)
// ---------------------------------------------------------------------------

router.get('/esus-procedimento-map', async (req, res, next) => {
  try {
    const { secao, q, status } = req.query;
    const params = [];
    const conditions = [];
    if (status) {
      params.push(status);
      conditions.push(`m.status = $${params.length}`);
    } else {
      conditions.push(`m.status != 'inativo'`);
    }
    if (secao) {
      params.push(secao);
      conditions.push(`m.secao = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(
        `(m.descricao_esus ILIKE $${params.length} OR p.codigo_sigtap ILIKE $${params.length} OR p.descricao ILIKE $${params.length})`
      );
    }
    const { rows } = await query(
      `${MAP_SELECT}
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.secao, m.descricao_esus`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/esus-procedimento-map', async (req, res, next) => {
  try {
    const { secao, descricao_esus, procedimento_id, codigo_sigtap, descricao, origem } = req.body;
    if (!secao || !descricao_esus) {
      return res.status(400).json({ error: 'secao e descricao_esus são obrigatórios' });
    }
    const procId = await resolveProcedimentoId({ procedimento_id, codigo_sigtap, descricao });
    const { rows } = await query(
      `INSERT INTO esus_procedimento_map (secao, descricao_esus, procedimento_id, origem, status)
       VALUES ($1, $2, $3, $4, 'ativo')
       RETURNING id`,
      [secao, descricao_esus, procId, origem || 'manual']
    );
    const joined = await query(`${MAP_SELECT} WHERE m.id=$1`, [rows[0].id]);
    res.status(201).json(joined.rows[0]);
  } catch (err) { next(err); }
});

router.put('/esus-procedimento-map/:id', async (req, res, next) => {
  try {
    const { secao, descricao_esus, procedimento_id, codigo_sigtap, descricao, origem, status } = req.body;
    const existing = await query(
      `SELECT id FROM esus_procedimento_map WHERE id=$1`,
      [req.params.id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'Mapeamento não encontrado' });
    }

    let procId = procedimento_id;
    if (codigo_sigtap && !procedimento_id) {
      procId = await resolveProcedimentoId({ codigo_sigtap, descricao });
    } else if (procedimento_id) {
      procId = await resolveProcedimentoId({ procedimento_id });
    } else {
      const cur = await query(
        `SELECT procedimento_id FROM esus_procedimento_map WHERE id=$1`,
        [req.params.id]
      );
      procId = cur.rows[0].procedimento_id;
    }

    await query(
      `UPDATE esus_procedimento_map
       SET secao=COALESCE($1, secao),
           descricao_esus=COALESCE($2, descricao_esus),
           procedimento_id=$3,
           origem=COALESCE($4, origem),
           status=COALESCE($5, status),
           atualizado_em=now()
       WHERE id=$6`,
      [secao || null, descricao_esus || null, procId, origem || null, status || null, req.params.id]
    );
    const joined = await query(`${MAP_SELECT} WHERE m.id=$1`, [req.params.id]);
    res.json(joined.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/esus-procedimento-map/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE esus_procedimento_map SET status='inativo', atualizado_em=now()
       WHERE id=$1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Mapeamento não encontrado' });
    res.json({ inativado: true, id: parseInt(req.params.id, 10) });
  } catch (err) { next(err); }
});

module.exports = router;
