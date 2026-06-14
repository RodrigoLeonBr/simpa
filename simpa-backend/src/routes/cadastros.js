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

module.exports = router;
