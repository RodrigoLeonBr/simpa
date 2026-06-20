const express = require('express');
const multer = require('multer');
const os = require('os');

const { query } = require('../services/db');
const { preview, processar } = require('../services/parser');
const { runConsolidation } = require('../services/consolidator');
const {
  buildPath,
  hashFile,
  moveFile,
  removeFile,
  removeTempFile,
} = require('../services/storage');
const requirePlanningStaff = require('../middleware/requirePlanningStaff');
const {
  competenciaDate,
  competenciaLabel,
  enrichPreviewItem,
  resolveForUpload,
  listMapeamentos,
  upsertMapeamento,
  deactivateMapeamento,
} = require('../services/importMappingService');

const router = express.Router();

const MAX_UPLOAD_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || String(50 * 1024 * 1024), 10);
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
});

function parseResolucoes(raw) {
  if (raw == null || raw === '') {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return null;
    }
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  return null;
}

function resolucaoMap(resolucoes) {
  const map = new Map();
  for (const item of resolucoes) {
    if (item?.arquivo) {
      map.set(item.arquivo, item);
    }
  }
  return map;
}

async function updateArquivoPath(meta, destPath, hash, { estabelecimentoId, equipeId } = {}) {
  if (estabelecimentoId != null && equipeId != null) {
    await query(
      `UPDATE esus_cargas
       SET arquivo_path = $1,
           hash_arquivo = $2,
           arquivo_origem = COALESCE(arquivo_origem, $3)
       WHERE tipo_relatorio = $4
         AND competencia = $5
         AND estabelecimento_id = $6
         AND equipe_id = $7`,
      [
        destPath,
        hash,
        meta.arquivo_origem,
        meta.tipo_relatorio,
        competenciaDate(meta.competencia),
        estabelecimentoId,
        equipeId,
      ]
    );
    return;
  }

  await query(
    `UPDATE esus_cargas
     SET arquivo_path = $1,
         hash_arquivo = $2,
         arquivo_origem = COALESCE(arquivo_origem, $3)
     WHERE tipo_relatorio = $4
       AND competencia = $5
       AND unidade = $6
       AND equipe_nome = $7`,
    [
      destPath,
      hash,
      meta.arquivo_origem,
      meta.tipo_relatorio,
      competenciaDate(meta.competencia),
      meta.unidade,
      meta.equipe_nome,
    ]
  );
}

async function triggerConsolidation(meta, resolved) {
  try {
    const output = await runConsolidation(
      resolved?.estabelecimentoId != null && resolved?.equipeId != null
        ? {
            competencia: competenciaLabel(meta.competencia),
            estabelecimentoId: resolved.estabelecimentoId,
            equipeId: resolved.equipeId,
          }
        : {
            competencia: competenciaLabel(meta.competencia),
            unidade: meta.unidade,
            equipe: meta.equipe_nome,
          }
    );
    return { ok: true, result: output.result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

router.post('/preview', upload.array('files'), async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Envie ao menos um arquivo CSV em files[]' });
    }

    const resultados = [];
    let pendingCount = 0;

    for (const file of req.files) {
      try {
        const metaList = await preview(file.path);
        const meta = metaList[0];
        if (!meta) {
          resultados.push({
            nome: file.originalname,
            error: 'Não foi possível detectar metadados do CSV',
          });
          continue;
        }

        const enriched = await enrichPreviewItem(
          { ...meta, nome: file.originalname, arquivo_origem: file.originalname },
          { userId: req.user?.id }
        );
        if (enriched.mapeamento_status === 'pending') {
          pendingCount += 1;
        }
        resultados.push(enriched);
      } catch (err) {
        resultados.push({
          nome: file.originalname,
          error: err.message || 'Erro ao analisar CSV',
        });
      } finally {
        removeTempFile(file.path);
      }
    }

    if (pendingCount > 0) {
      console.log(
        JSON.stringify({
          event: 'import.preview.pending_mapping',
          requestId: req.requestId,
          pending_count: pendingCount,
          file_count: req.files.length,
        })
      );
    }

    return res.json(resultados);
  } catch (err) {
    req.files?.forEach((file) => removeTempFile(file.path));
    return next(err);
  }
});

router.post('/upload', requirePlanningStaff, upload.array('files'), async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Envie ao menos um arquivo CSV em files[]' });
    }

    const resolucoes = parseResolucoes(req.body.resolucoes);
    if (!resolucoes?.length) {
      req.files.forEach((file) => removeTempFile(file.path));
      return res.status(400).json({ error: 'Campo resolucoes é obrigatório (JSON array)' });
    }

    const byArquivo = resolucaoMap(resolucoes);
    for (const file of req.files) {
      if (!byArquivo.has(file.originalname)) {
        req.files.forEach((f) => removeTempFile(f.path));
        return res.status(400).json({
          error: `Resolução ausente para o arquivo: ${file.originalname}`,
        });
      }
    }

    const resultados = [];
    for (const file of req.files) {
      const resolucao = byArquivo.get(file.originalname);

      try {
        const metaList = await preview(file.path);
        const meta = metaList[0];
        if (!meta) {
          removeTempFile(file.path);
          resultados.push({
            arquivo: file.originalname,
            error: 'Não foi possível detectar metadados do CSV',
          });
          continue;
        }

        const resolved = await resolveForUpload(meta, resolucao, req.user);

        const destPath = buildPath(
          competenciaLabel(meta.competencia),
          meta.unidade,
          file.originalname
        );
        moveFile(file.path, destPath);

        const hash = hashFile(destPath);
        const resultado = await processar(destPath, {
          estabelecimentoId: resolved.estabelecimentoId,
          equipeId: resolved.equipeId,
        });
        await updateArquivoPath(meta, destPath, hash, resolved);

        const consolidacao = await triggerConsolidation(meta, resolved);
        resultados.push({
          arquivo: file.originalname,
          arquivo_path: destPath,
          hash_arquivo: hash,
          estabelecimento_id: resolved.estabelecimentoId,
          equipe_id: resolved.equipeId,
          ...resultado[0],
          consolidacao,
        });
      } catch (err) {
        removeTempFile(file.path);
        if (err.status === 409) {
          return res.status(409).json({
            error: err.message,
            conflito_todas: err.conflito_todas,
          });
        }
        if (err.status === 400) {
          return res.status(400).json({ error: err.message });
        }
        if (err.status === 422) {
          resultados.push({
            arquivo: file.originalname,
            error: err.message,
          });
          continue;
        }
        throw err;
      }
    }

    const hasErrors = resultados.some((row) => row.error);
    return res.status(hasErrors ? 422 : 201).json(resultados);
  } catch (err) {
    req.files?.forEach((file) => removeTempFile(file.path));
    return next(err);
  }
});

router.get('/mapeamentos', async (req, res, next) => {
  try {
    const result = await listMapeamentos(req.query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.post('/mapeamentos', requirePlanningStaff, async (req, res, next) => {
  try {
    const row = await upsertMapeamento(req.body, req.user);
    console.log(
      JSON.stringify({
        event: 'import.mapeamento.created',
        requestId: req.requestId,
        esus_unidade_label: row.esus_unidade_label,
        estabelecimento_id: row.estabelecimento_id,
      })
    );
    return res.status(201).json(row);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

router.put('/mapeamentos/:id', requirePlanningStaff, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT esus_unidade_label, esus_equipe_codigo, esus_equipe_nome
       FROM esus_import_mapeamentos WHERE id = $1 AND status = 'ativo'`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Mapeamento não encontrado' });
    }

    const existing = rows[0];
    const row = await upsertMapeamento(
      {
        esus_unidade_label: req.body.esus_unidade_label ?? existing.esus_unidade_label,
        esus_equipe_codigo: req.body.esus_equipe_codigo ?? existing.esus_equipe_codigo,
        esus_equipe_nome: req.body.esus_equipe_nome ?? existing.esus_equipe_nome,
        estabelecimento_id: req.body.estabelecimento_id,
        equipe_id: req.body.equipe_id,
      },
      req.user
    );
    return res.json(row);
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ error: err.message });
    }
    return next(err);
  }
});

router.delete('/mapeamentos/:id', requirePlanningStaff, async (req, res, next) => {
  try {
    const result = await deactivateMapeamento(req.params.id, req.user);
    return res.json(result);
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ error: err.message });
    }
    return next(err);
  }
});

router.get('/cargas', async (req, res, next) => {
  try {
    const { competencia, unidade } = req.query;
    const conditions = [];
    const params = [];

    if (competencia) {
      params.push(competenciaDate(competencia));
      conditions.push(`c.competencia = $${params.length}`);
    }
    if (unidade) {
      params.push(`%${unidade}%`);
      conditions.push(`c.unidade ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT c.id, c.tipo_relatorio, c.competencia, c.unidade, c.equipe_nome,
              c.estabelecimento_id, c.equipe_id,
              est.nome AS estabelecimento_nome, est.codigo_externo AS estabelecimento_codigo,
              eq.nome AS equipe_cadastro_nome,
              c.arquivo_origem, c.arquivo_path, c.hash_arquivo, c.registros_identificados,
              c.registros_nao_identificados, c.importado_em
       FROM esus_cargas c
       LEFT JOIN estabelecimentos est ON est.id = c.estabelecimento_id
       LEFT JOIN equipes eq ON eq.id = c.equipe_id
       ${where}
       ORDER BY c.importado_em DESC`,
      params
    );

    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/reprocessar', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM esus_cargas WHERE id = $1', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Carga não encontrada' });
    }

    const carga = rows[0];
    if (!carga.arquivo_path) {
      return res.status(400).json({ error: 'Arquivo físico não encontrado para esta carga' });
    }

    const parserOptions =
      carga.estabelecimento_id != null && carga.equipe_id != null
        ? {
            estabelecimentoId: carga.estabelecimento_id,
            equipeId: carga.equipe_id,
          }
        : {};

    const resultado = await processar(carga.arquivo_path, parserOptions);
    const consolidacao = await triggerConsolidation(
      {
        competencia: carga.competencia,
        unidade: carga.unidade,
        equipe_nome: carga.equipe_nome,
      },
      carga.estabelecimento_id != null && carga.equipe_id != null
        ? {
            estabelecimentoId: carga.estabelecimento_id,
            equipeId: carga.equipe_id,
          }
        : null
    );

    return res.json({ ...resultado[0], consolidacao });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/substituir', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Envie o arquivo CSV no campo file' });
    }

    const { rows } = await query('SELECT * FROM esus_cargas WHERE id = $1', [req.params.id]);
    if (!rows.length) {
      removeTempFile(req.file.path);
      return res.status(404).json({ error: 'Carga não encontrada' });
    }

    const carga = rows[0];
    const metaList = await preview(req.file.path);
    const meta = metaList[0];
    if (!meta) {
      removeTempFile(req.file.path);
      return res.status(422).json({ error: 'CSV inválido' });
    }

    const destPath = buildPath(
      competenciaLabel(meta.competencia),
      meta.unidade,
      req.file.originalname
    );

    if (carga.arquivo_path && carga.arquivo_path !== destPath) {
      removeFile(carga.arquivo_path);
    }
    moveFile(req.file.path, destPath);

    const hash = hashFile(destPath);
    const parserOptions =
      carga.estabelecimento_id != null && carga.equipe_id != null
        ? {
            estabelecimentoId: carga.estabelecimento_id,
            equipeId: carga.equipe_id,
          }
        : {};
    const resultado = await processar(destPath, parserOptions);
    await query(
      `UPDATE esus_cargas
       SET arquivo_path = $1, hash_arquivo = $2, arquivo_origem = $3
       WHERE id = $4`,
      [destPath, hash, req.file.originalname, req.params.id]
    );

    const consolidacao = await triggerConsolidation(
      meta,
      carga.estabelecimento_id != null && carga.equipe_id != null
        ? {
            estabelecimentoId: carga.estabelecimento_id,
            equipeId: carga.equipe_id,
          }
        : null
    );
    return res.json({
      ...resultado[0],
      arquivo_path: destPath,
      hash_arquivo: hash,
      consolidacao,
    });
  } catch (err) {
    removeTempFile(req.file?.path);
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, arquivo_path FROM esus_cargas WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Carga não encontrada' });
    }

    if (rows[0].arquivo_path) {
      removeFile(rows[0].arquivo_path);
    }

    await query('DELETE FROM esus_cargas WHERE id = $1', [req.params.id]);
    return res.json({ deleted: true, id: Number(req.params.id) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
