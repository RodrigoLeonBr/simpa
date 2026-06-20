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

const router = express.Router();

const MAX_UPLOAD_BYTES = parseInt(process.env.UPLOAD_MAX_BYTES || String(50 * 1024 * 1024), 10);
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 10 },
});

function competenciaDate(value) {
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  if (/^\d{4}-\d{2}$/.test(str)) {
    return `${str}-01`;
  }
  return str;
}

function competenciaLabel(value) {
  return competenciaDate(value).slice(0, 7);
}

async function cargaExists(meta) {
  const { rows } = await query(
    `SELECT id FROM esus_cargas
     WHERE tipo_relatorio = $1
       AND competencia = $2
       AND unidade = $3
       AND equipe_nome = $4`,
    [
      meta.tipo_relatorio,
      competenciaDate(meta.competencia),
      meta.unidade,
      meta.equipe_nome,
    ]
  );
  return rows.length > 0;
}

async function updateArquivoPath(meta, destPath, hash) {
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

async function triggerConsolidation(meta) {
  try {
    const output = await runConsolidation({
      competencia: competenciaLabel(meta.competencia),
      unidade: meta.unidade,
      equipe: meta.equipe_nome,
    });
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

        const jaImportado = await cargaExists(meta);
        resultados.push({
          nome: file.originalname,
          ...meta,
          competencia: competenciaLabel(meta.competencia),
          ja_importado: jaImportado,
        });
      } finally {
        removeTempFile(file.path);
      }
    }

    return res.json(resultados);
  } catch (err) {
    req.files?.forEach((file) => removeTempFile(file.path));
    return next(err);
  }
});

router.post('/upload', upload.array('files'), async (req, res, next) => {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ error: 'Envie ao menos um arquivo CSV em files[]' });
    }

    const resultados = [];
    for (const file of req.files) {
      const metaList = await preview(file.path);
      const meta = metaList[0];
      if (!meta) {
        removeTempFile(file.path);
        return res.status(422).json({ error: `CSV inválido: ${file.originalname}` });
      }

      const destPath = buildPath(
        competenciaLabel(meta.competencia),
        meta.unidade,
        file.originalname
      );
      moveFile(file.path, destPath);

      const hash = hashFile(destPath);
      const resultado = await processar(destPath);
      await updateArquivoPath(meta, destPath, hash);

      const consolidacao = await triggerConsolidation(meta);
      resultados.push({
        arquivo: file.originalname,
        arquivo_path: destPath,
        hash_arquivo: hash,
        ...resultado[0],
        consolidacao,
      });
    }

    return res.status(201).json(resultados);
  } catch (err) {
    req.files?.forEach((file) => removeTempFile(file.path));
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
      conditions.push(`competencia = $${params.length}`);
    }
    if (unidade) {
      params.push(`%${unidade}%`);
      conditions.push(`unidade ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(
      `SELECT id, tipo_relatorio, competencia, unidade, equipe_nome,
              arquivo_origem, arquivo_path, hash_arquivo, registros_identificados,
              registros_nao_identificados, importado_em
       FROM esus_cargas
       ${where}
       ORDER BY importado_em DESC`,
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

    const resultado = await processar(carga.arquivo_path);
    const consolidacao = await triggerConsolidation({
      competencia: carga.competencia,
      unidade: carga.unidade,
      equipe_nome: carga.equipe_nome,
    });

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
    const resultado = await processar(destPath);
    await query(
      `UPDATE esus_cargas
       SET arquivo_path = $1, hash_arquivo = $2, arquivo_origem = $3
       WHERE id = $4`,
      [destPath, hash, req.file.originalname, req.params.id]
    );

    const consolidacao = await triggerConsolidation(meta);
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
