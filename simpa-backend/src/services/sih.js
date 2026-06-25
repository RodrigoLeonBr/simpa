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
    `SELECT status, qtd_internacoes, qtd_procedimentos, sincronizado_em
     FROM sih_sincronizacoes
     WHERE competencia = $1
       AND status IN ('ok', 'parcial')
     ORDER BY sincronizado_em DESC
     LIMIT 1`,
    [competenciaDate]
  );

  if (!rows.length) {
    return {
      exists: false,
      status: null,
      qtd_internacoes: 0,
      qtd_procedimentos: 0,
      sincronizado_em: null,
    };
  }

  return {
    exists: true,
    status: rows[0].status,
    qtd_internacoes: Number(rows[0].qtd_internacoes || 0),
    qtd_procedimentos: Number(rows[0].qtd_procedimentos || 0),
    sincronizado_em: rows[0].sincronizado_em,
  };
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
  scriptPath,
  pythonBin,
  parseSyncOutput,
};
