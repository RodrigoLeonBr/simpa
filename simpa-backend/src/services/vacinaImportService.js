'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { pool, query } = require('./db');

// ponytail: parser lives at repo root; from here that's 3 levels up
const PARSER_SCRIPT = path.resolve(__dirname, '../../../parse_vacina_xlsx.py');

const pythonBin = process.env.PYTHON_BIN || 'python3';

/**
 * Invoke the Python parser on an xlsx file.
 * @param {string} xlsxPath
 * @returns {Promise<{competencia:string, doses_total:number, arquivo_nome:string, linhas:Array}>}
 */
function parseUpload(xlsxPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonBin, [PARSER_SCRIPT, xlsxPath], {
      cwd: path.dirname(PARSER_SCRIPT),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    proc.on('error', reject);

    proc.on('close', (code) => {
      if (code !== 0) {
        const err = new Error(stderr.trim() || `parse_vacina_xlsx exit ${code}`);
        err.status = 422;
        err.details = stderr.trim();
        return reject(err);
      }
      const trimmed = stdout.trim();
      try {
        resolve(JSON.parse(trimmed));
      } catch {
        const err = new Error('Saída JSON inválida do parser de vacinas');
        err.status = 502;
        err.details = trimmed.slice(0, 200);
        reject(err);
      }
    });
  });
}

/**
 * Persist parsed doses inside a single transaction.
 * Re-import of the same competência replaces the prior carga (CASCADE removes doses).
 * @param {{competencia, doses_total, arquivo_nome, linhas:Array}} parsed
 * @param {string|null} importadoPor
 * @returns {Promise<{carga_id, competencia, doses_total, linhas}>}
 */
async function gravarCarga(parsed, importadoPor) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Replace existing carga for this competência (cascade drops its doses)
    await client.query(
      'DELETE FROM vacina_cargas WHERE competencia = $1',
      [parsed.competencia]
    );

    const { rows } = await client.query(
      `INSERT INTO vacina_cargas
         (competencia, arquivo_nome, linhas, doses_total, importado_por)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        parsed.competencia,
        parsed.arquivo_nome,
        parsed.linhas.length,
        parsed.doses_total,
        importadoPor,
      ]
    );
    const carga_id = rows[0].id;

    for (const linha of parsed.linhas) {
      await client.query(
        `INSERT INTO vacina_doses
           (carga_id, competencia, cnes_sala, sala_nome, imuno_codigo, imuno_nome,
            faixa_nies, sistema_origem, doses)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (carga_id, cnes_sala, imuno_codigo, faixa_nies, sistema_origem)
         DO UPDATE SET doses = vacina_doses.doses + EXCLUDED.doses`,
        [
          carga_id,
          parsed.competencia,
          linha.cnes_sala,
          linha.sala_nome,
          linha.imuno_codigo,
          linha.imuno_nome,
          linha.faixa_nies,
          linha.sistema_origem,
          linha.doses,
        ]
      );

      await client.query(
        `INSERT INTO vacina_imunobiologicos (imuno_codigo, imuno_nome)
         VALUES ($1, $2)
         ON CONFLICT (imuno_codigo) DO UPDATE SET imuno_nome = EXCLUDED.imuno_nome`,
        [linha.imuno_codigo, linha.imuno_nome]
      );
    }

    await client.query('COMMIT');
    return { carga_id, competencia: parsed.competencia, doses_total: parsed.doses_total, linhas: parsed.linhas.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Returns preview metadata including faixas not yet mapped in vacina_faixa_grupo.
 * @param {{competencia, doses_total, linhas:Array}} parsed
 * @returns {Promise<{competencia, doses_total, linhas, faixas_nao_mapeadas:string[]}>}
 */
async function analisarPreview(parsed) {
  const { rows } = await query(
    'SELECT faixa_nies FROM vacina_faixa_grupo WHERE grupo_id IS NOT NULL'
  );
  const mapeadas = new Set(rows.map((r) => r.faixa_nies));
  const distintas = [...new Set(parsed.linhas.map((l) => l.faixa_nies))];
  const faixas_nao_mapeadas = distintas.filter((f) => !mapeadas.has(f));

  return {
    competencia: parsed.competencia,
    doses_total: parsed.doses_total,
    linhas: parsed.linhas.length,
    faixas_nao_mapeadas,
  };
}

module.exports = { parseUpload, gravarCarga, analisarPreview, pythonBin };
