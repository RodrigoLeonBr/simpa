const express = require('express');
const multer  = require('multer');
const os      = require('os');
const fs      = require('fs');

const { query } = require('../services/db');
const { buildPath, moverArquivo, removerArquivo } = require('../services/storage');
const { preview, processar } = require('../services/parser');

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

router.post('/preview', upload.array('files'), async (req, res, next) => {
  try {
    const resultados = [];
    for (const file of req.files) {
      const meta = await preview(file.path);
      fs.unlinkSync(file.path);
      const m = meta[0];
      const existe = await query(
        `SELECT id FROM esus_cargas
         WHERE tipo_relatorio=$1 AND competencia=$2 AND unidade=$3 AND equipe_nome=$4`,
        [m?.tipo_relatorio, m?.competencia, m?.unidade, m?.equipe_nome]
      );
      resultados.push({
        nome: file.originalname,
        ...m,
        ja_importado: existe.rows.length > 0,
      });
    }
    res.json(resultados);
  } catch (err) { next(err); }
});

router.post('/upload', upload.array('files'), async (req, res, next) => {
  try {
    const resultados = [];
    for (const file of req.files) {
      const meta = await preview(file.path);
      const m = meta[0];

      const destPath = buildPath(m.competencia, m.unidade, file.originalname);
      moverArquivo(file.path, destPath);

      const resultado = await processar(destPath);

      await query(
        `UPDATE esus_cargas SET arquivo_path=$1
         WHERE tipo_relatorio=$2 AND competencia=$3 AND unidade=$4 AND equipe_nome=$5`,
        [destPath, m.tipo_relatorio, m.competencia, m.unidade, m.equipe_nome]
      );

      resultados.push({ arquivo: file.originalname, ...resultado[0] });
    }
    res.status(201).json(resultados);
  } catch (err) { next(err); }
});

router.get('/cargas', async (req, res, next) => {
  try {
    const { competencia, unidade } = req.query;
    const conditions = [];
    const params = [];

    if (competencia) {
      params.push(competencia + '-01');
      conditions.push(`competencia = $${params.length}`);
    }
    if (unidade) {
      params.push(`%${unidade}%`);
      conditions.push(`unidade ILIKE $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const { rows } = await query(
      `SELECT id, tipo_relatorio, competencia, unidade, equipe_nome,
              arquivo_origem, arquivo_path, registros_identificados,
              registros_nao_identificados, importado_em
       FROM esus_cargas ${where}
       ORDER BY importado_em DESC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/:id/reprocessar', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM esus_cargas WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Carga não encontrada' });
    const carga = rows[0];
    if (!carga.arquivo_path) {
      return res.status(400).json({ error: 'Arquivo físico não encontrado para esta carga' });
    }
    const resultado = await processar(carga.arquivo_path);
    res.json(resultado[0]);
  } catch (err) { next(err); }
});

router.put('/:id/substituir', upload.single('file'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM esus_cargas WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Carga não encontrada' });
    const carga = rows[0];

    const meta = await preview(req.file.path);
    const m = meta[0];
    const destPath = buildPath(m.competencia, m.unidade, req.file.originalname);

    if (carga.arquivo_path && carga.arquivo_path !== destPath) {
      removerArquivo(carga.arquivo_path);
    }
    moverArquivo(req.file.path, destPath);

    const resultado = await processar(destPath);
    await query(
      `UPDATE esus_cargas SET arquivo_path=$1, arquivo_origem=$2 WHERE id=$3`,
      [destPath, req.file.originalname, req.params.id]
    );

    res.json({ ...resultado[0], arquivo_path: destPath });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT arquivo_path FROM esus_cargas WHERE id=$1', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Carga não encontrada' });

    if (rows[0].arquivo_path) removerArquivo(rows[0].arquivo_path);
    await query('DELETE FROM esus_cargas WHERE id=$1', [req.params.id]);

    res.json({ deleted: true, id: parseInt(req.params.id) });
  } catch (err) { next(err); }
});

module.exports = router;
