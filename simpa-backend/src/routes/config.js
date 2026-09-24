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

// Lista de competências (YYYY-MM) do menor ao maior mês com dados nas três fontes
// analisadas: SIA (sia_producao), SIH (sih_internacoes) e e-SUS (dados_consolidados).
router.get('/competencias', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `WITH bounds AS (
         SELECT
           LEAST(
             (SELECT MIN(competencia) FROM sia_producao),
             (SELECT MIN(competencia) FROM sih_internacoes),
             (SELECT MIN(competencia) FROM dados_consolidados)
           ) AS min_c,
           GREATEST(
             (SELECT MAX(competencia) FROM sia_producao),
             (SELECT MAX(competencia) FROM sih_internacoes),
             (SELECT MAX(competencia) FROM dados_consolidados)
           ) AS max_c
       )
       SELECT to_char(gs, 'YYYY-MM') AS competencia
       FROM bounds,
            generate_series(date_trunc('month', min_c), date_trunc('month', max_c), interval '1 month') gs
       WHERE min_c IS NOT NULL AND max_c IS NOT NULL
       ORDER BY gs DESC`,
    );
    return res.json({ competencias: rows.map((r) => r.competencia) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
