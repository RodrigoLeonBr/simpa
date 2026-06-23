const express = require('express');
const { query } = require('../services/db');
const { sincronizar } = require('../services/sia');
const { runConsolidation } = require('../services/consolidator');
const { listProducao } = require('../services/siaProducaoService');
const requirePlanningStaff = require('../middleware/requirePlanningStaff');

const router = express.Router();

function normalizeCompetencia(competencia) {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) {
    return null;
  }
  return `${competencia}-01`;
}

async function getCompetenciaImportada(competencia) {
  const competenciaDate = normalizeCompetencia(competencia);
  if (!competenciaDate) {
    return null;
  }

  const { rows } = await query(
    `SELECT status, registros, sincronizado_em
     FROM sia_sincronizacoes
     WHERE competencia = $1
       AND status IN ('ok', 'parcial')
     ORDER BY sincronizado_em DESC
     LIMIT 1`,
    [competenciaDate]
  );

  if (!rows.length) {
    return {
      exists: false,
      status: null,
      registros: 0,
      sincronizado_em: null,
    };
  }

  return {
    exists: true,
    status: rows[0].status,
    registros: Number(rows[0].registros || 0),
    sincronizado_em: rows[0].sincronizado_em,
  };
}

router.post('/sincronizar', requirePlanningStaff, async (req, res, next) => {
  try {
    const { competencia, reimportar } = req.body || {};
    if (!normalizeCompetencia(competencia)) {
      return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
    }

    const existe = await getCompetenciaImportada(competencia);
    if (existe?.exists && reimportar !== true) {
      return res.status(409).json({
        code: 'SIA_COMPETENCIA_JA_IMPORTADA',
        competencia,
        sincronizado_em: existe.sincronizado_em,
        registros: existe.registros,
      });
    }

    const resultado = await sincronizar(competencia, { reimportar: reimportar === true });
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

router.get('/sincronizacoes/existe', async (req, res, next) => {
  try {
    const { competencia } = req.query || {};
    if (!normalizeCompetencia(competencia)) {
      return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
    }

    const existe = await getCompetenciaImportada(competencia);
    return res.json({
      competencia,
      ...existe,
    });
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
    const rows = await listProducao(req.query);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
