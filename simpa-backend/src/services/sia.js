const { spawn } = require('child_process');
const path = require('path');

const progressRuns = new Map();
const PROGRESS_TTL_MS = 60 * 60 * 1000;

function scriptPath() {
  return (
    process.env.SIA_SYNC_SCRIPT ||
    path.join(__dirname, '../../../sync_sia_mysql.py')
  );
}

function pythonBin() {
  return process.env.PYTHON_BIN || 'python3';
}

function parseSyncOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = JSON.parse(trimmed);
  if (Array.isArray(parsed)) {
    return parsed.length === 1 ? parsed[0] : parsed;
  }
  return parsed;
}

function toNumberOrNull(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return Math.round(value);
}

function nowIso() {
  return new Date().toISOString();
}

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
  if (!executionId || !progressRuns.has(executionId)) {
    return;
  }
  const entry = progressRuns.get(executionId);
  const normalized = {
    at: nowIso(),
    stage: payload.stage || payload.event || entry.stage || 'processando',
    event: payload.event || payload.stage || 'evento',
    message: payload.message || null,
    block_index: toNumberOrNull(payload.block_index),
    block_rows: toNumberOrNull(payload.block_rows),
    offset: toNumberOrNull(payload.offset),
    duration_ms: toNumberOrNull(payload.duration_ms),
    extracted_rows_total: toNumberOrNull(payload.extracted_rows_total),
    transformed_rows_total: toNumberOrNull(payload.transformed_rows_total),
    inserted_rows_total: toNumberOrNull(payload.inserted_rows_total),
    total_rows: toNumberOrNull(payload.total_rows),
    chunks_total: toNumberOrNull(payload.chunks_total),
    chunk_index: toNumberOrNull(payload.chunk_index),
    rows_processed: toNumberOrNull(payload.rows_processed),
  };

  entry.lastUpdatedAt = normalized.at;
  entry.stage = normalized.stage;
  entry.events.push(normalized);
  if (entry.events.length > 120) {
    entry.events.shift();
  }
}

function finalizeProgressSuccess(executionId, result) {
  if (!executionId || !progressRuns.has(executionId)) {
    return;
  }
  const entry = progressRuns.get(executionId);
  entry.lastUpdatedAt = nowIso();
  entry.finishedAt = Date.now();
  entry.status = result?.status === 'erro' ? 'erro' : 'done';
  entry.stage = result?.status === 'erro' ? 'erro' : 'concluido';
  entry.summary = {
    status: result?.status || 'ok',
    registros: Number(result?.registros || 0),
    erros: Number(result?.erros || 0),
    linhas_mysql_raw: Number(result?.linhas_mysql_raw || 0),
  };
}

function finalizeProgressError(executionId, errorMessage) {
  if (!executionId || !progressRuns.has(executionId)) {
    return;
  }
  const entry = progressRuns.get(executionId);
  entry.lastUpdatedAt = nowIso();
  entry.finishedAt = Date.now();
  entry.status = 'erro';
  entry.stage = 'erro';
  entry.error = errorMessage;
}

function extractProgressFromStderr(executionId, stderrChunk, parserState) {
  if (!executionId) {
    return;
  }
  parserState.buffer += stderrChunk;
  const lines = parserState.buffer.split(/\r?\n/);
  parserState.buffer = lines.pop() || '';

  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line.startsWith('SIA_PROGRESS ')) {
      continue;
    }
    const jsonPart = line.slice('SIA_PROGRESS '.length);
    try {
      const payload = JSON.parse(jsonPart);
      updateProgress(executionId, payload);
    } catch (_err) {
      // ignora linhas malformadas de progresso
    }
  }
}

function sincronizar(competencia, options = {}) {
  const { reimportar = false, executionId = null } = options;
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const args = [script, '--competencia', competencia, '--pg-write'];
    if (reimportar) {
      args.push('--reimportar');
    }
    if (executionId) {
      args.push('--exec-id', executionId);
      initProgress(executionId, competencia);
      updateProgress(executionId, {
        stage: 'iniciando',
        event: 'start',
        message: 'Sincronização SIA iniciada',
      });
    }
    const proc = spawn(
      pythonBin(),
      args,
      {
        cwd: path.dirname(script),
        env: {
          ...process.env,
          PYTHONUTF8: process.env.PYTHONUTF8 || '1',
          PYTHONIOENCODING: process.env.PYTHONIOENCODING || 'utf-8',
        },
      }
    );

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
      if (parserState.buffer.trim().startsWith('SIA_PROGRESS ')) {
        extractProgressFromStderr(executionId, '\n', parserState);
      }
      if (code !== 0) {
        const error = new Error(stderr.trim() || `sync_sia_mysql exit ${code}`);
        error.status = 502;
        error.details = stderr.trim();
        finalizeProgressError(executionId, error.message);
        reject(error);
        return;
      }

      try {
        const result = parseSyncOutput(stdout);
        if (!result) {
          const error = new Error('Saída vazia do sync SIA');
          error.status = 502;
          finalizeProgressError(executionId, error.message);
          reject(error);
          return;
        }
        finalizeProgressSuccess(executionId, result);
        resolve(result);
      } catch (_err) {
        const error = new Error('Saída JSON inválida do sync SIA');
        error.status = 502;
        error.details = stdout.trim().slice(0, 200);
        finalizeProgressError(executionId, error.message);
        reject(error);
      }
    });
  });
}

function getSyncProgress(executionId) {
  if (!executionId) {
    return null;
  }
  cleanupProgressRuns();
  const entry = progressRuns.get(executionId);
  if (!entry) {
    return null;
  }
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

module.exports = { sincronizar, scriptPath, pythonBin, parseSyncOutput, getSyncProgress };
