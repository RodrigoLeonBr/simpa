const express = require('express');
const { fetchDashboard } = require('../services/dashboardService');
const { runConsolidation } = require('../services/consolidator');
const { resolvePainelLayout } = require('../services/painelWidgetsService');

const router = express.Router();
const COMPETENCIA_RE = /^\d{4}-\d{2}$/;

function parseOptionalInt(value) {
  if (value == null || value === '') {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

router.get('/planejamento', async (req, res, next) => {
  try {
    const { competencia, unidade, equipe, estabelecimento_id, equipe_id } =
      req.query;
    const result = await fetchDashboard({
      competencia,
      unidade,
      equipe,
      estabelecimento_id,
      equipe_id,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

router.get('/painel-layout', async (req, res, next) => {
  try {
    const {
      competencia,
      perfil = 'APS',
      layout = 'A',
      estabelecimento_id,
      equipe_id,
    } = req.query;

    if (!competencia || !COMPETENCIA_RE.test(String(competencia))) {
      return res.status(400).json({
        error: 'competencia inválida — use YYYY-MM',
      });
    }

    const estabelecimentoId = parseOptionalInt(estabelecimento_id);
    const equipeId = parseOptionalInt(equipe_id);

    if (estabelecimento_id != null && estabelecimento_id !== '' && estabelecimentoId == null) {
      return res.status(400).json({
        error: 'estabelecimento_id inválido',
      });
    }

    if (equipe_id != null && equipe_id !== '' && equipeId == null) {
      return res.status(400).json({
        error: 'equipe_id inválido',
      });
    }

    const result = await resolvePainelLayout({
      competencia: String(competencia),
      perfil: String(perfil),
      layout: String(layout),
      estabelecimentoId,
      equipeId,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    return next(err);
  }
});

router.post('/consolidar', async (req, res, next) => {
  try {
    const { all, competencia, unidade, equipe } = req.query;
    const runAll = all === 'true' || all === '1';

    if (runAll) {
      const output = await runConsolidation({ all: true });
      return res.status(200).json(output);
    }

    if (!competencia || !unidade || !equipe) {
      return res.status(400).json({
        error:
          'Informe all=true ou os parâmetros competencia, unidade e equipe (YYYY-MM)',
      });
    }

    const output = await runConsolidation({ competencia, unidade, equipe });
    return res.status(200).json(output);
  } catch (err) {
    if (err.status) {
      err.status = err.status;
    }
    return next(err);
  }
});

module.exports = router;
