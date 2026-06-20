const express = require('express');
const { query } = require('../services/db');
const { sincronizar } = require('../services/sia');
const { runConsolidation } = require('../services/consolidator');

const router = express.Router();

router.post('/sincronizar', async (req, res, next) => {
  try {
    const { competencia } = req.body;
    if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
      return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
    }

    const resultado = await sincronizar(competencia);
    let consolidacao = null;

    if (resultado.status === 'ok' || resultado.status === 'parcial') {
      try {
        consolidacao = await runConsolidation({ all: true });
      } catch (err) {
        consolidacao = { ok: false, error: err.message };
      }
    }

    return res.status(201).json({ ...resultado, consolidacao });
  } catch (err) {
    return next(err);
  }
});

router.get('/sincronizacoes', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, competencia, status, registros, erros, sincronizado_em
       FROM sia_sincronizacoes
       ORDER BY competencia DESC`
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.get('/producao', async (req, res, next) => {
  try {
    const { competencia, unidade, codigo_sigtap } = req.query;
    const conditions = [];
    const params = [];

    if (competencia) {
      params.push(`${competencia}-01`);
      conditions.push(`competencia = $${params.length}`);
    }
    if (unidade) {
      params.push(`%${unidade}%`);
      conditions.push(`unidade ILIKE $${params.length}`);
    }
    if (codigo_sigtap) {
      params.push(codigo_sigtap);
      conditions.push(`codigo_sigtap = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT codigo_sigtap, descricao, faixa_etaria, sexo, cbo,
              SUM(quantidade) AS quantidade, SUM(valor_aprovado) AS valor_aprovado
       FROM sia_producao ${where}
       GROUP BY codigo_sigtap, descricao, faixa_etaria, sexo, cbo
       ORDER BY quantidade DESC`,
      params
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
