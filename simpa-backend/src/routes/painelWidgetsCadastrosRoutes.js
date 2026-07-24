const requirePlanningStaff = require('../middleware/requirePlanningStaff');
const { logAudit } = require('../services/auditService');
const {
  listWidgets,
  getWidgetById,
  createWidget,
  updateWidget,
  reorderWidgets,
  inactivateWidget,
  previewWidget,
} = require('../services/painelWidgetsService');

function registerPainelWidgetsCadastrosRoutes(router) {
  router.get('/painel-widgets', async (req, res, next) => {
    try {
      const { perfil = 'APS', layout = 'A', include_inactive } = req.query;
      const rows = await listWidgets({
        perfil,
        layout,
        includeInactive: include_inactive === 'true' || include_inactive === '1',
      });
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  router.get('/painel-widgets/:id', async (req, res, next) => {
    try {
      const row = await getWidgetById(req.params.id);
      return res.json(row);
    } catch (err) {
      return next(err);
    }
  });

  router.post('/painel-widgets', requirePlanningStaff, async (req, res, next) => {
    try {
      const row = await createWidget(req.body);
      const usuarioId = req.user.id;

      await logAudit({
        usuarioId,
        acao: 'painel_widget_create',
        recurso: 'painel_widgets',
        detalhes: JSON.stringify({
          widget_id: row.id,
          slug: row.slug,
          perfil: row.perfil,
          layout: row.layout,
        }),
        ip: req.ip,
      });

      return res.status(201).json(row);
    } catch (err) {
      return next(err);
    }
  });

  router.put('/painel-widgets/:id', requirePlanningStaff, async (req, res, next) => {
    try {
      const row = await updateWidget(req.params.id, req.body);
      const usuarioId = req.user.id;

      await logAudit({
        usuarioId,
        acao: 'painel_widget_update',
        recurso: 'painel_widgets',
        detalhes: JSON.stringify({
          widget_id: row.id,
          slug: row.slug,
          perfil: row.perfil,
          layout: row.layout,
        }),
        ip: req.ip,
      });

      return res.json(row);
    } catch (err) {
      return next(err);
    }
  });

  router.patch('/painel-widgets/reorder', requirePlanningStaff, async (req, res, next) => {
    try {
      const { perfil, layout, orderedIds } = req.body || {};
      if (!perfil || !layout || !Array.isArray(orderedIds) || !orderedIds.length) {
        return res.status(400).json({
          error: 'perfil, layout e orderedIds são obrigatórios',
        });
      }

      const reordered = await reorderWidgets(perfil, layout, orderedIds);
      const usuarioId = req.user.id;

      await logAudit({
        usuarioId,
        acao: 'painel_widget_reorder',
        recurso: 'painel_widgets',
        detalhes: JSON.stringify({
          perfil,
          layout,
          orderedIds,
        }),
        ip: req.ip,
      });

      return res.json(reordered);
    } catch (err) {
      return next(err);
    }
  });

  router.delete('/painel-widgets/:id', requirePlanningStaff, async (req, res, next) => {
    try {
      const result = await inactivateWidget(req.params.id);
      const usuarioId = req.user.id;

      await logAudit({
        usuarioId,
        acao: 'painel_widget_inactivate',
        recurso: 'painel_widgets',
        detalhes: JSON.stringify({
          widget_id: result.id,
        }),
        ip: req.ip,
      });

      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });

  router.post('/painel-widgets/preview', requirePlanningStaff, async (req, res, next) => {
    try {
      const { widgetId, widget, scope } = req.body || {};
      // Prefer draft `widget` (unsaved form) over widgetId — otherwise edit-drawer
      // preview always reloads the persisted row and ignores on-screen SQL/métricas.
      const payload = widget != null ? widget : widgetId;
      const preview = await previewWidget(payload, scope || {});
      return res.json(preview);
    } catch (err) {
      return next(err);
    }
  });
}

module.exports = { registerPainelWidgetsCadastrosRoutes };
