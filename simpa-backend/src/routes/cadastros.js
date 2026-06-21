const express = require('express');
const { ENTITIES } = require('../services/cadastroRegistry');
const {
  listEntity,
  createEntity,
  updateEntity,
  inactivateEntity,
} = require('../services/cadastrosService');
const {
  sincronizar,
  listSyncHistory,
  getLatestSync,
} = require('../services/cadastrosSync');
const {
  listEstabelecimentos,
  getEstabelecimentoById,
  updatePerfil,
  upsertEnrichment,
  updateEnriquecimento,
  PERFIL_TO_SLUG,
} = require('../services/estabelecimentosService');
const {
  listProcedimentos,
  getProcedimentoById,
} = require('../services/procedimentosService');
const { logAudit } = require('../services/auditService');
const requirePlanningStaff = require('../middleware/requirePlanningStaff');
const { registerPainelWidgetsCadastrosRoutes } = require('./painelWidgetsCadastrosRoutes');
const { registerPainelMetricasCadastrosRoutes } = require('./painelMetricasCadastrosRoutes');

const router = express.Router();

router.post('/sincronizar', requirePlanningStaff, async (req, res, next) => {
  try {
    const resultado = await sincronizar();

    if (resultado.status === 'ok') {
      await logAudit({
        usuarioId: req.user?.id ?? null,
        acao: 'cadastros_sincronizar',
        recurso: 'cadastros',
        detalhes: JSON.stringify({
          estabelecimentos: resultado.estabelecimentos,
          procedimentos: resultado.procedimentos,
        }),
        ip: req.ip,
      });
    }

    return res.status(201).json(resultado);
  } catch (err) {
    return next(err);
  }
});

router.get('/sincronizacoes/ultima', async (_req, res, next) => {
  try {
    const ultima = await getLatestSync();
    return res.json(ultima);
  } catch (err) {
    return next(err);
  }
});

router.get('/sincronizacoes', async (req, res, next) => {
  try {
    const history = await listSyncHistory({
      page: req.query.page,
      limit: req.query.limit,
    });
    return res.json(history);
  } catch (err) {
    return next(err);
  }
});

router.get('/estabelecimentos', async (req, res, next) => {
  try {
    const result = await listEstabelecimentos(req.query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.put('/estabelecimentos/:id/perfil', requirePlanningStaff, async (req, res, next) => {
  try {
    const row = await updatePerfil(req.params.id, req.body?.perfil);

    await logAudit({
      usuarioId: req.user?.id ?? null,
      acao: 'estabelecimento_perfil_update',
      recurso: 'estabelecimentos',
      detalhes: JSON.stringify({
        estabelecimento_id: Number(req.params.id),
        perfil: row.perfil,
      }),
      ip: req.ip,
    });

    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

router.put(
  '/estabelecimentos/:id/enriquecimento/:slug',
  requirePlanningStaff,
  async (req, res, next) => {
    try {
      const row = await upsertEnrichment(req.params.id, req.params.slug, req.body);

      await logAudit({
        usuarioId: req.user?.id ?? null,
        acao: 'estabelecimento_enriquecimento_update',
        recurso: 'estabelecimentos',
        detalhes: JSON.stringify({
          estabelecimento_id: Number(req.params.id),
          slug: req.params.slug,
        }),
        ip: req.ip,
      });

      return res.json(row);
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/estabelecimentos/:id/enriquecimento',
  requirePlanningStaff,
  async (req, res, next) => {
    try {
      const row = await updateEnriquecimento(req.params.id, req.body);

      await logAudit({
        usuarioId: req.user?.id ?? null,
        acao: 'estabelecimento_enriquecimento_update',
        recurso: 'estabelecimentos',
        detalhes: JSON.stringify({
          estabelecimento_id: Number(req.params.id),
          slug: PERFIL_TO_SLUG[row.perfil] || 'hospitalar',
          legacy: true,
        }),
        ip: req.ip,
      });

      return res.json(row);
    } catch (err) {
      return next(err);
    }
  }
);

router.get('/estabelecimentos/:id', async (req, res, next) => {
  try {
    const row = await getEstabelecimentoById(req.params.id);
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

router.get('/procedimentos', async (req, res, next) => {
  try {
    const result = await listProcedimentos(req.query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.get('/procedimentos/:id', async (req, res, next) => {
  try {
    const row = await getProcedimentoById(req.params.id);
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

function readOnlyWriteHandler(_req, res) {
  return res.status(405).json({
    error: 'Procedimentos são somente leitura. Use POST /api/cadastros/sincronizar.',
    allow: 'GET',
  });
}

router.post('/procedimentos', readOnlyWriteHandler);
router.put('/procedimentos/:id', readOnlyWriteHandler);
router.delete('/procedimentos/:id', readOnlyWriteHandler);

function registerResource(pathKey) {
  router.get(`/${pathKey}`, async (req, res, next) => {
    try {
      const rows = await listEntity(pathKey, req.query);
      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  });

  router.post(`/${pathKey}`, async (req, res, next) => {
    try {
      const row = await createEntity(pathKey, req.body);
      return res.status(201).json(row);
    } catch (err) {
      return next(err);
    }
  });

  router.put(`/${pathKey}/:id`, async (req, res, next) => {
    try {
      const row = await updateEntity(pathKey, req.params.id, req.body);
      return res.json(row);
    } catch (err) {
      return next(err);
    }
  });

  router.delete(`/${pathKey}/:id`, async (req, res, next) => {
    try {
      const result = await inactivateEntity(pathKey, req.params.id);
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  });
}

Object.keys(ENTITIES).forEach(registerResource);
registerPainelWidgetsCadastrosRoutes(router);
registerPainelMetricasCadastrosRoutes(router);

module.exports = router;
