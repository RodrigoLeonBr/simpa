'use strict';

const express = require('express');
const multer = require('multer');
const os = require('os');

const { removeTempFile } = require('../services/storage');
const requirePlanningStaff = require('../middleware/requirePlanningStaff');
const { parseUpload, gravarCarga, analisarPreview } = require('../services/vacinaImportService');
const { getCobertura } = require('../services/vacinaService');
const {
  listGrupos,
  createGrupo,
  updateGrupo,
  listFaixaGrupo,
  setFaixaGrupo,
  listPopulacao,
  upsertPopulacao,
  listEsquema,
  upsertEsquema,
  deleteEsquema,
  listImunobiologicos,
} = require('../services/vacinaCadastroService');
const { query } = require('../services/db');

const router = express.Router();

// ponytail: verifyJWT already applied at app level (app.use('/api', verifyJWT, apiRoutes))

const MAX_UPLOAD_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || String(50 * 1024 * 1024), 10);
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

function normalizeCompetencia(c) {
  if (!c || !/^\d{4}-\d{2}$/.test(c)) return null;
  const mes = parseInt(c.split('-')[1], 10);
  if (mes < 1 || mes > 12) return null;
  return `${c}-01`;
}

// ── Import ────────────────────────────────────────────────────────────────────

router.post('/importacao/preview', requirePlanningStaff, upload.single('arquivo'), async (req, res, next) => {
  const file = req.file;
  try {
    if (!file) return res.status(400).json({ error: 'Envie o arquivo no campo arquivo' });

    const parsed = await parseUpload(file.path);
    parsed.arquivo_nome = file.originalname;

    if (!parsed.competencia) {
      return res.status(422).json({ error: 'competência não detectada; informe manualmente' });
    }

    return res.json(await analisarPreview(parsed));
  } catch (err) {
    return next(err);
  } finally {
    removeTempFile(file?.path);
  }
});

router.post('/importacao', requirePlanningStaff, upload.single('arquivo'), async (req, res, next) => {
  const file = req.file;
  try {
    if (!file) return res.status(400).json({ error: 'Envie o arquivo no campo arquivo' });

    const parsed = await parseUpload(file.path);
    parsed.arquivo_nome = file.originalname;

    if (req.body.competencia) {
      const normalized = normalizeCompetencia(req.body.competencia);
      if (!normalized) return res.status(400).json({ error: 'competencia deve ser YYYY-MM' });
      parsed.competencia = normalized;
    }

    if (!parsed.competencia) {
      return res.status(422).json({ error: 'competência não detectada; informe manualmente' });
    }

    return res.status(201).json(await gravarCarga(parsed, req.user?.email || null));
  } catch (err) {
    return next(err);
  } finally {
    removeTempFile(file?.path);
  }
});

router.get('/cargas', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM vacina_cargas ORDER BY competencia DESC');
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// ── Cobertura ─────────────────────────────────────────────────────────────────

router.get('/cobertura', async (req, res, next) => {
  try {
    const ano = parseInt(req.query.ano, 10);
    if (!Number.isFinite(ano) || ano < 2000 || ano > 2100) {
      return res.status(400).json({ error: 'ano deve ser inteiro entre 2000 e 2100' });
    }

    const competenciaAte =
      normalizeCompetencia(req.query.competencia) || `${ano}-12-01`;

    const grupoId = req.query.grupo_id ? parseInt(req.query.grupo_id, 10) : undefined;
    const imunoCodigo = req.query.imuno_codigo || undefined;

    return res.json(await getCobertura({ ano, competenciaAte, grupoId, imunoCodigo }));
  } catch (err) {
    return next(err);
  }
});

// ── Cadastros ─────────────────────────────────────────────────────────────────

router.get('/imunobiologicos', async (req, res, next) => {
  try {
    return res.json(await listImunobiologicos());
  } catch (err) {
    return next(err);
  }
});

router.get('/grupos', async (req, res, next) => {
  try {
    return res.json(await listGrupos());
  } catch (err) {
    return next(err);
  }
});

router.post('/grupos', requirePlanningStaff, async (req, res, next) => {
  try {
    return res.status(201).json(await createGrupo(req.body));
  } catch (err) {
    return next(err);
  }
});

router.put('/grupos/:id', requirePlanningStaff, async (req, res, next) => {
  try {
    return res.json(await updateGrupo(Number(req.params.id), req.body));
  } catch (err) {
    return next(err);
  }
});

router.get('/faixa-grupo', async (req, res, next) => {
  try {
    return res.json(await listFaixaGrupo());
  } catch (err) {
    return next(err);
  }
});

router.put('/faixa-grupo/:faixa', requirePlanningStaff, async (req, res, next) => {
  try {
    return res.json(await setFaixaGrupo(req.params.faixa, req.body.grupo_id ?? null));
  } catch (err) {
    return next(err);
  }
});

router.get('/populacao', async (req, res, next) => {
  try {
    const ano = req.query.ano ? Number(req.query.ano) : null;
    return res.json(await listPopulacao(ano));
  } catch (err) {
    return next(err);
  }
});

router.post('/populacao', requirePlanningStaff, async (req, res, next) => {
  try {
    const { ano, grupo_id, populacao } = req.body;
    if (!Number.isFinite(Number(ano)) || !Number.isFinite(Number(grupo_id)) || !Number.isFinite(Number(populacao))) {
      return res.status(400).json({ error: 'ano, grupo_id e populacao devem ser numéricos' });
    }
    return res.status(201).json(await upsertPopulacao({
      ano: Number(ano),
      grupo_id: Number(grupo_id),
      populacao: Number(populacao),
    }));
  } catch (err) {
    return next(err);
  }
});

router.get('/esquema', async (req, res, next) => {
  try {
    return res.json(await listEsquema());
  } catch (err) {
    return next(err);
  }
});

router.post('/esquema', requirePlanningStaff, async (req, res, next) => {
  try {
    const { imuno_codigo, grupo_id, num_doses } = req.body;
    if (!imuno_codigo || typeof imuno_codigo !== 'string') {
      return res.status(400).json({ error: 'imuno_codigo é obrigatório (string)' });
    }
    if (!Number.isFinite(Number(grupo_id)) || Number(num_doses) <= 0) {
      return res.status(400).json({ error: 'grupo_id deve ser numérico e num_doses > 0' });
    }
    return res.status(201).json(await upsertEsquema({
      imuno_codigo,
      grupo_id: Number(grupo_id),
      num_doses: Number(num_doses),
    }));
  } catch (err) {
    return next(err);
  }
});

router.delete('/esquema/:id', requirePlanningStaff, async (req, res, next) => {
  try {
    return res.json(await deleteEsquema(Number(req.params.id)));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
