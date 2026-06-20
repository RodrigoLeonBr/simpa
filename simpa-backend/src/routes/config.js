const express = require('express');
const { query } = require('../services/db');

const router = express.Router();

const COMPETENCIA_PADRAO_CHAVE = 'competencia_ativa_padrao';
const COMPETENCIA_RE = /^\d{4}-\d{2}$/;

router.get('/competencia-padrao', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT valor FROM configuracoes WHERE chave = $1`,
      [COMPETENCIA_PADRAO_CHAVE],
    );
    const valor = rows[0]?.valor;
    const competencia =
      typeof valor === 'string' && COMPETENCIA_RE.test(valor) ? valor : '2026-05';
    return res.json({ competencia });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
