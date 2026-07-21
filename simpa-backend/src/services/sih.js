'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { query } = require('./db');

const progressRuns = new Map();
const PROGRESS_TTL_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function scriptPath() {
  return (
    process.env.SIH_SYNC_SCRIPT ||
    path.join(__dirname, '../../../sync_sih_mysql.py')
  );
}

function pythonBin() {
  return process.env.PYTHON_BIN || 'python3';
}

function parseSyncOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return parsed.length === 1 ? parsed[0] : parsed;
  }
  return parsed;
}

function toNumberOrNull(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeCompetencia(competencia) {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return null;
  const mes = parseInt(competencia.split('-')[1], 10);
  if (mes < 1 || mes > 12) return null;
  return `${competencia}-01`;
}

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

function cleanupProgressRuns() {
  const now = Date.now();
  for (const [id, entry] of progressRuns.entries()) {
    if (entry.finishedAt && now - entry.finishedAt > PROGRESS_TTL_MS) {
      progressRuns.delete(id);
    }
  }
}

function initProgress(executionId, competencia) {
  cleanupProgressRuns();
  progressRuns.set(executionId, {
    executionId,
    competencia,
    startedAt: nowIso(),
    lastUpdatedAt: nowIso(),
    finishedAt: null,
    status: 'running',
    stage: 'iniciando',
    summary: null,
    error: null,
    events: [],
  });
}

function updateProgress(executionId, payload = {}) {
  if (!executionId || !progressRuns.has(executionId)) return;
  const entry = progressRuns.get(executionId);
  const normalized = {
    at: nowIso(),
    stage: payload.stage || payload.event || entry.stage || 'processando',
    event: payload.event || payload.stage || 'evento',
    message: payload.message || null,
    block_index: toNumberOrNull(payload.block_index),
    block_rows: toNumberOrNull(payload.block_rows),
    duration_ms: toNumberOrNull(payload.duration_ms),
    inserted_rows_total: toNumberOrNull(payload.inserted_rows_total),
    rows_processed: toNumberOrNull(payload.rows_processed),
    chunk_index: toNumberOrNull(payload.chunk_index),
    chunks_total: toNumberOrNull(payload.chunks_total),
    table: payload.table || null,
  };
  entry.lastUpdatedAt = normalized.at;
  entry.stage = normalized.stage;
  entry.events.push(normalized);
  if (entry.events.length > 120) {
    entry.events.shift();
  }
}

function finalizeProgressSuccess(executionId, result) {
  if (!executionId || !progressRuns.has(executionId)) return;
  const entry = progressRuns.get(executionId);
  entry.lastUpdatedAt = nowIso();
  entry.finishedAt = Date.now();
  entry.status = result?.status === 'erro' ? 'erro' : 'done';
  entry.stage = result?.status === 'erro' ? 'erro' : 'concluido';
  entry.summary = {
    status: result?.status || 'ok',
    qtd_aih: Number(result?.qtd_aih || 0),
    qtd_internacoes: Number(result?.qtd_internacoes || 0),
    qtd_procedimentos: Number(result?.qtd_procedimentos || 0),
    orphan_cnes: Number(result?.orphan_cnes || 0),
    erros: Number(result?.erros || 0),
    linhas_mysql_raw: Number(result?.linhas_mysql_raw || 0),
  };
}

function finalizeProgressError(executionId, errorMessage) {
  if (!executionId || !progressRuns.has(executionId)) return;
  const entry = progressRuns.get(executionId);
  entry.lastUpdatedAt = nowIso();
  entry.finishedAt = Date.now();
  entry.status = 'erro';
  entry.stage = 'erro';
  entry.error = errorMessage;
}

function extractProgressFromStderr(executionId, stderrChunk, parserState) {
  if (!executionId) return;
  parserState.buffer += stderrChunk;
  const lines = parserState.buffer.split(/\r?\n/);
  parserState.buffer = lines.pop() || '';

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line.startsWith('SIH_PROGRESS ')) continue;
    const jsonPart = line.slice('SIH_PROGRESS '.length);
    try {
      const payload = JSON.parse(jsonPart);
      updateProgress(executionId, payload);
    } catch (_err) {
      // ignora linhas malformadas
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function getCompetenciaImportada(competencia) {
  const competenciaDate = normalizeCompetencia(competencia);
  if (!competenciaDate) return null;

  const { rows } = await query(
    `SELECT s.status, s.qtd_aih, s.qtd_internacoes, s.sincronizado_em,
            COALESCE((
              SELECT SUM(p.qtd_linhas)::int
              FROM sih_procedimentos p
              WHERE p.sincronizacao_id = s.id
            ), s.qtd_procedimentos, 0) AS qtd_procedimentos
     FROM sih_sincronizacoes s
     WHERE s.competencia = $1
       AND s.status IN ('ok', 'parcial')
     ORDER BY s.sincronizado_em DESC
     LIMIT 1`,
    [competenciaDate]
  );

  if (!rows.length) {
    return {
      exists: false,
      status: null,
      qtd_aih: 0,
      qtd_internacoes: 0,
      qtd_procedimentos: 0,
      sincronizado_em: null,
    };
  }

  return {
    exists: true,
    status: rows[0].status,
    qtd_aih: Number(rows[0].qtd_aih || 0),
    qtd_internacoes: Number(rows[0].qtd_internacoes || 0),
    qtd_procedimentos: Number(rows[0].qtd_procedimentos || 0),
    sincronizado_em: rows[0].sincronizado_em,
  };
}

/**
 * Lista histórico de sync SIHD com totais e detalhe por CNES
 * (AIH brutas + linhas agregadas de internações/procedimentos).
 */
async function listSincronizacoes() {
  const { rows: syncRows } = await query(
    `SELECT id, competencia, status, qtd_aih, qtd_internacoes, qtd_procedimentos,
            orphan_cnes, erros, sincronizado_em
     FROM sih_sincronizacoes
     ORDER BY competencia DESC`
  );

  if (!syncRows.length) return [];

  const { rows: cnesRows } = await query(
    `WITH cnes_keys AS (
       SELECT sincronizacao_id, cnes FROM sih_aih
       UNION
       SELECT sincronizacao_id, cnes FROM sih_internacoes
       UNION
       SELECT sincronizacao_id, cnes FROM sih_procedimentos
     ),
     aih AS (
       SELECT sincronizacao_id, cnes, COUNT(*)::int AS qtd_aih
       FROM sih_aih
       GROUP BY sincronizacao_id, cnes
     ),
     ints AS (
       SELECT sincronizacao_id, cnes, COUNT(*)::int AS qtd_internacoes
       FROM sih_internacoes
       GROUP BY sincronizacao_id, cnes
     ),
     procs AS (
       SELECT sincronizacao_id, cnes,
              COALESCE(SUM(qtd_linhas), 0)::int AS qtd_procedimentos
       FROM sih_procedimentos
       GROUP BY sincronizacao_id, cnes
     )
     SELECT
       k.sincronizacao_id,
       k.cnes,
       COALESCE(e.nome, k.cnes) AS unidade,
       COALESCE(a.qtd_aih, 0)::int AS qtd_aih,
       COALESCE(i.qtd_internacoes, 0)::int AS qtd_internacoes,
       COALESCE(p.qtd_procedimentos, 0)::int AS qtd_procedimentos
     FROM cnes_keys k
     LEFT JOIN aih a
       ON a.sincronizacao_id = k.sincronizacao_id AND a.cnes = k.cnes
     LEFT JOIN ints i
       ON i.sincronizacao_id = k.sincronizacao_id AND i.cnes = k.cnes
     LEFT JOIN procs p
       ON p.sincronizacao_id = k.sincronizacao_id AND p.cnes = k.cnes
     LEFT JOIN estabelecimentos e ON e.codigo_externo = k.cnes
     ORDER BY k.sincronizacao_id, a.qtd_aih DESC NULLS LAST, k.cnes`
  );

  const bySync = new Map();
  for (const row of cnesRows) {
    const id = Number(row.sincronizacao_id);
    if (!bySync.has(id)) bySync.set(id, []);
    bySync.get(id).push({
      cnes: row.cnes,
      unidade: row.unidade,
      qtd_aih: Number(row.qtd_aih || 0),
      qtd_internacoes: Number(row.qtd_internacoes || 0),
      qtd_procedimentos: Number(row.qtd_procedimentos || 0),
    });
  }

  return syncRows.map((row) => {
    const porCnes = bySync.get(Number(row.id)) || [];
    const qtdProcedimentos = porCnes.length
      ? porCnes.reduce((acc, c) => acc + Number(c.qtd_procedimentos || 0), 0)
      : Number(row.qtd_procedimentos || 0);
    return {
      id: row.id,
      competencia: row.competencia,
      status: row.status,
      qtd_aih: Number(row.qtd_aih || 0),
      qtd_internacoes: Number(row.qtd_internacoes || 0),
      qtd_procedimentos: qtdProcedimentos,
      orphan_cnes: Number(row.orphan_cnes || 0),
      erros: Number(row.erros || 0),
      sincronizado_em: row.sincronizado_em,
      por_cnes: porCnes,
    };
  });
}

function sincronizar(competencia, options = {}) {
  const { reimportar = false, executionId = null } = options;
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const args = [script, '--competencia', competencia, '--pg-write'];
    if (reimportar) args.push('--reimportar');
    if (executionId) {
      args.push('--exec-id', executionId);
      initProgress(executionId, competencia);
      updateProgress(executionId, {
        stage: 'iniciando',
        event: 'start',
        message: 'Sincronização SIHD iniciada',
      });
    }

    const proc = spawn(pythonBin(), args, {
      cwd: path.dirname(script),
      env: {
        ...process.env,
        PYTHONUTF8: process.env.PYTHONUTF8 || '1',
        PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';
    const parserState = { buffer: '' };

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      extractProgressFromStderr(executionId, text, parserState);
    });

    proc.on('error', (err) => {
      finalizeProgressError(executionId, err.message);
      reject(err);
    });

    proc.on('close', (code) => {
      if (parserState.buffer.trim().startsWith('SIH_PROGRESS ')) {
        extractProgressFromStderr(executionId, '\n', parserState);
      }
      if (code !== 0) {
        const error = new Error(stderr.trim() || `sync_sih_mysql exit ${code}`);
        error.status = 502;
        error.details = stderr.trim();
        finalizeProgressError(executionId, error.message);
        reject(error);
        return;
      }
      try {
        const result = parseSyncOutput(stdout);
        if (!result) {
          const error = new Error('Saída vazia do sync SIHD');
          error.status = 502;
          finalizeProgressError(executionId, error.message);
          reject(error);
          return;
        }
        finalizeProgressSuccess(executionId, result);
        resolve(result);
      } catch (_err) {
        const error = new Error('Saída JSON inválida do sync SIHD');
        error.status = 502;
        error.details = stdout.trim().slice(0, 200);
        finalizeProgressError(executionId, error.message);
        reject(error);
      }
    });
  });
}

function getSyncProgress(executionId) {
  if (!executionId) return null;
  cleanupProgressRuns();
  const entry = progressRuns.get(executionId);
  if (!entry) return null;
  return {
    executionId: entry.executionId,
    competencia: entry.competencia,
    startedAt: entry.startedAt,
    lastUpdatedAt: entry.lastUpdatedAt,
    status: entry.status,
    stage: entry.stage,
    summary: entry.summary,
    error: entry.error,
    events: entry.events,
  };
}

module.exports = {
  sincronizar,
  getSyncProgress,
  getCompetenciaImportada,
  listSincronizacoes,
  scriptPath,
  pythonBin,
  parseSyncOutput,
};
