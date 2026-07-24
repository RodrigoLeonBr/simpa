const requirePlanningStaff = require('../middleware/requirePlanningStaff');
const { logAudit } = require('../services/auditService');
const {
  listMetricas,
  getMetricaById,
  discoverPainelMetricas,
} = require('../services/painelMetricsService');

function registerPainelMetricasCadastrosRoutes(router) {
  router.get('/painel-metricas', async (req, res, next) => {
    try {
      const result = await listMetricas({
        q: req.query.q,
        fonte_tipo: req.query.fonte_tipo,
        page: req.query.page,
        limit: req.query.limit,
      });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  router.get('/painel-metricas/:id', async (req, res, next) => {
    try {
      const row = await getMetricaById(req.params.id);
      return res.json(row);
    } catch (err) {
      return next(err);
    }
  });

  router.post('/painel-metricas/descobrir', requirePlanningStaff, async (req, res, next) => {
    try {
      const result = await discoverPainelMetricas();
      const usuarioId = req.user.id;

      await logAudit({
        usuarioId,
        acao: 'painel_metricas_descobrir',
        recurso: 'painel_metricas_catalogo',
        detalhes: JSON.stringify(result),
        ip: req.ip,
      });

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  });
}

module.exports = { registerPainelMetricasCadastrosRoutes };
