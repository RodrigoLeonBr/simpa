/**
 * On-demand e-SUS → SIGTAP export (task_05 / ADR-004).
 * GET /api/procedimentos/export
 */
const express = require('express');
const {
  normalizeCompetencia,
  resolveMappedProcedures,
} = require('../services/procedimentoMap');

const router = express.Router();

const CSV_COLUMNS = [
  'competencia',
  'unidade',
  'equipe',
  'secao',
  'descricao_esus',
  'codigo_sigtap',
  'descricao_sigtap',
  'quantidade',
];

/**
 * RFC 4180 field escape.
 * @param {unknown} value
 * @returns {string}
 */
function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build CSV body (header + rows). competencia/unidade/equipe stamped from request.
 * @param {Array<{secao, descricao_esus, codigo_sigtap, descricao_sigtap, quantidade}>} rows
 * @param {{competencia: string, unidade: string, equipe: string}} meta
 * @returns {string}
 */
function rowsToCsv(rows, meta) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        meta.competencia,
        meta.unidade,
        meta.equipe,
        r.secao,
        r.descricao_esus,
        r.codigo_sigtap,
        r.descricao_sigtap,
        r.quantidade,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\r\n') + (lines.length ? '\r\n' : '');
}

/**
 * Filename-safe competencia segment (YYYY-MM).
 */
function competenciaFileSlug(competencia) {
  const d = normalizeCompetencia(competencia);
  return d.slice(0, 7);
}

router.get('/export', async (req, res, next) => {
  try {
    const { competencia, unidade, equipe } = req.query;
    let format = String(req.query.format || 'json').toLowerCase();
    if (format !== 'json' && format !== 'csv') {
      const err = new Error('format inválido (use json ou csv)');
      err.status = 400;
      throw err;
    }

    // competencia validated inside resolve via normalizeCompetencia
    const rows = await resolveMappedProcedures(competencia, unidade, equipe);
    const compNorm = normalizeCompetencia(competencia);

    console.log(
      '[procedimentos/export]',
      JSON.stringify({
        competencia: compNorm,
        unidade,
        equipe,
        row_count: rows.length,
        format,
      })
    );

    if (format === 'csv') {
      const slug = competenciaFileSlug(competencia);
      const body = rowsToCsv(rows, {
        competencia: compNorm,
        unidade,
        equipe,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="procedimentos-mapeados-${slug}.csv"`
      );
      return res.status(200).send(body);
    }

    return res.status(200).json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.CSV_COLUMNS = CSV_COLUMNS;
module.exports.csvEscape = csvEscape;
module.exports.rowsToCsv = rowsToCsv;
module.exports.competenciaFileSlug = competenciaFileSlug;
