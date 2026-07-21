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
  updateIdentidade,
  upsertEnrichment,
  updateEnriquecimento,
  PERFIL_TO_SLUG,
} = require('../services/estabelecimentosService');
const {
  listLeitosVigencias,
  createLeitosVigencia,
  updateLeitosVigencia,
  deleteLeitosVigencia,
} = require('../services/leitosVigenciaService');
const {
  listProcedimentos,
  getProcedimentoById,
} = require('../services/procedimentosService');
const { listFormas } = require('../services/formasService');
const { listCbos } = require('../services/cbosService');
const {
  listMetasOciPar,
  createMetaOciPar,
  updateMetaOciPar,
  inactivateMetaOciPar,
} = require('../services/metasOciParService');
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
          formas: resultado.formas,
          cbos: resultado.cbos,
          rubricas: resultado.rubricas,
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

router.put('/estabelecimentos/:id/identidade', requirePlanningStaff, async (req, res, next) => {
  try {
    const row = await updateIdentidade(req.params.id, {
      nome: req.body?.nome,
      status: req.body?.status,
    });

    await logAudit({
      usuarioId: req.user?.id ?? null,
      acao: 'estabelecimento_identidade_update',
      recurso: 'estabelecimentos',
      detalhes: JSON.stringify({
        estabelecimento_id: Number(req.params.id),
        nome: row.nome,
        status: row.status,
        nome_editado: row.nome_editado,
        status_editado: row.status_editado,
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

router.get('/estabelecimentos/:id/leitos-vigencias', async (req, res, next) => {
  try {
    const rows = await listLeitosVigencias(req.params.id);
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.post(
  '/estabelecimentos/:id/leitos-vigencias',
  requirePlanningStaff,
  async (req, res, next) => {
    try {
      const row = await createLeitosVigencia(req.params.id, req.body);

      await logAudit({
        usuarioId: req.user?.id ?? null,
        acao: 'estabelecimento_leitos_vigencia_update',
        recurso: 'estabelecimentos',
        detalhes: JSON.stringify({ estabelecimento_id: Number(req.params.id) }),
        ip: req.ip,
      });

      return res.status(201).json(row);
    } catch (err) {
      return next(err);
    }
  }
);

router.put(
  '/estabelecimentos/:id/leitos-vigencias/:vigenciaId',
  requirePlanningStaff,
  async (req, res, next) => {
    try {
      const row = await updateLeitosVigencia(req.params.id, req.params.vigenciaId, req.body);

      await logAudit({
        usuarioId: req.user?.id ?? null,
        acao: 'estabelecimento_leitos_vigencia_update',
        recurso: 'estabelecimentos',
        detalhes: JSON.stringify({ estabelecimento_id: Number(req.params.id) }),
        ip: req.ip,
      });

      return res.json(row);
    } catch (err) {
      return next(err);
    }
  }
);

router.delete(
  '/estabelecimentos/:id/leitos-vigencias/:vigenciaId',
  requirePlanningStaff,
  async (req, res, next) => {
    try {
      const result = await deleteLeitosVigencia(req.params.id, req.params.vigenciaId);

      await logAudit({
        usuarioId: req.user?.id ?? null,
        acao: 'estabelecimento_leitos_vigencia_update',
        recurso: 'estabelecimentos',
        detalhes: JSON.stringify({ estabelecimento_id: Number(req.params.id) }),
        ip: req.ip,
      });

      return res.json(result);
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

function createReadOnlyWriteHandler(resourceLabel) {
  return (_req, res) =>
    res.status(405).json({
      error: `${resourceLabel} são somente leitura. Use POST /api/cadastros/sincronizar.`,
      allow: 'GET',
    });
}

router.post('/procedimentos', createReadOnlyWriteHandler('Procedimentos'));
router.put('/procedimentos/:id', createReadOnlyWriteHandler('Procedimentos'));
router.delete('/procedimentos/:id', createReadOnlyWriteHandler('Procedimentos'));

router.get('/formas', async (req, res, next) => {
  try {
    const result = await listFormas(req.query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/formas', createReadOnlyWriteHandler('Formas'));
router.put('/formas/:id', createReadOnlyWriteHandler('Formas'));
router.delete('/formas/:id', createReadOnlyWriteHandler('Formas'));

router.get('/cbos', async (req, res, next) => {
  try {
    const result = await listCbos(req.query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/cbos', createReadOnlyWriteHandler('CBOs'));
router.put('/cbos/:id', createReadOnlyWriteHandler('CBOs'));
router.delete('/cbos/:id', createReadOnlyWriteHandler('CBOs'));

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

router.get('/metas-oci-par', async (req, res, next) => {
  try {
    const rows = await listMetasOciPar({
      competencia: req.query.competencia,
      tipo_oci: req.query.tipo_oci,
    });
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.post('/metas-oci-par', requirePlanningStaff, async (req, res, next) => {
  try {
    const row = await createMetaOciPar(req.body);
    await logAudit({
      usuarioId: req.user?.id ?? null,
      acao: 'metas_oci_par_create',
      recurso: 'metas_oci_par',
      detalhes: JSON.stringify({ id: row.id, tipo_oci: row.tipo_oci }),
      ip: req.ip,
    });
    return res.status(201).json(row);
  } catch (err) {
    return next(err);
  }
});

router.put('/metas-oci-par/:id', requirePlanningStaff, async (req, res, next) => {
  try {
    const row = await updateMetaOciPar(req.params.id, req.body);
    await logAudit({
      usuarioId: req.user?.id ?? null,
      acao: 'metas_oci_par_update',
      recurso: 'metas_oci_par',
      detalhes: JSON.stringify({ id: row.id, tipo_oci: row.tipo_oci }),
      ip: req.ip,
    });
    return res.json(row);
  } catch (err) {
    return next(err);
  }
});

router.delete('/metas-oci-par/:id', requirePlanningStaff, async (req, res, next) => {
  try {
    await inactivateMetaOciPar(req.params.id);
    await logAudit({
      usuarioId: req.user?.id ?? null,
      acao: 'metas_oci_par_inactivate',
      recurso: 'metas_oci_par',
      detalhes: JSON.stringify({ id: Number(req.params.id) }),
      ip: req.ip,
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
