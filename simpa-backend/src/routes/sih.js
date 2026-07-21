'use strict';

const express = require('express');
const {
  sincronizar,
  getSyncProgress,
  getCompetenciaImportada,
  listSincronizacoes,
} = require('../services/sih');
const { runConsolidation } = require('../services/consolidator');
const { listInternacoes, listProcedimentos } = require('../services/sihProducaoService');
const requirePlanningStaff = require('../middleware/requirePlanningStaff');

const router = express.Router();

function normalizeCompetencia(competencia) {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return null;
  const mes = parseInt(competencia.split('-')[1], 10);
  if (mes < 1 || mes > 12) return null;
  return `${competencia}-01`;
}

// POST /api/sih/sincronizar
router.post('/sincronizar', requirePlanningStaff, async (req, res, next) => {
  try {
    const { competencia, reimportar, executionId } = req.body || {};

    if (!normalizeCompetencia(competencia)) {
      return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
    }
    if (executionId && !/^[a-zA-Z0-9_-]{8,80}$/.test(executionId)) {
      return res.status(400).json({ error: 'executionId inválido' });
    }

    const existe = await getCompetenciaImportada(competencia);
    if (existe?.exists && reimportar !== true) {
      return res.status(409).json({
        code: 'SIH_COMPETENCIA_JA_IMPORTADA',
        competencia,
        sincronizado_em: existe.sincronizado_em,
        qtd_aih: existe.qtd_aih,
        qtd_internacoes: existe.qtd_internacoes,
        qtd_procedimentos: existe.qtd_procedimentos,
      });
    }

    const resultado = await sincronizar(competencia, {
      reimportar: reimportar === true,
      executionId: executionId || null,
    });

    // MySQL indisponível — Python retorna exit 0 com error flag
    if (resultado.error === 'SIH_MYSQL_UNAVAILABLE') {
      return res.status(503).json({
        code: 'SIH_MYSQL_UNAVAILABLE',
        message:
          'Banco SIHD (XAMPP) indisponível. Verifique a conexão e tente novamente.',
      });
    }

    let consolidacao = null;
    if (resultado.status === 'ok' || resultado.status === 'parcial') {
      try {
        consolidacao = await runConsolidation({ all: true });
      } catch (err) {
        consolidacao = { ok: false, error: err.message };
      }
    }

    return res.status(200).json({ ...resultado, consolidacao });
  } catch (err) {
    return next(err);
  }
});

// GET /api/sih/sincronizar/progresso/:executionId
router.get('/sincronizar/progresso/:executionId', requirePlanningStaff, async (req, res) => {
  const { executionId } = req.params;
  const progress = getSyncProgress(executionId);
  if (!progress) {
    return res.status(404).json({ error: 'Execução não encontrada' });
  }
  return res.json(progress);
});

// GET /api/sih/sincronizacoes/existe
router.get('/sincronizacoes/existe', async (req, res, next) => {
  try {
    const { competencia } = req.query || {};
    if (!normalizeCompetencia(competencia)) {
      return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
    }
    const existe = await getCompetenciaImportada(competencia);
    return res.json({ competencia, ...existe });
  } catch (err) {
    return next(err);
  }
});

// GET /api/sih/sincronizacoes
router.get('/sincronizacoes', async (req, res, next) => {
  try {
    const rows = await listSincronizacoes();
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// GET /api/sih/internacoes
router.get('/internacoes', async (req, res, next) => {
  try {
    const rows = await listInternacoes(req.query);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// GET /api/sih/procedimentos
router.get('/procedimentos', async (req, res, next) => {
  try {
    const rows = await listProcedimentos(req.query);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
