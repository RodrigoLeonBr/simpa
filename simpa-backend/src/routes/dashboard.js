const express = require('express');
const { fetchDashboard } = require('../services/dashboardService');
const { runConsolidation } = require('../services/consolidator');

const router = express.Router();

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
