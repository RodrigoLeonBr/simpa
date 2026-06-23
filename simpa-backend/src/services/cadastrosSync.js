const { spawn } = require('child_process');
const path = require('path');
const { query } = require('./db');

const SYNC_TIMEOUT_MS = parseInt(
  process.env.CADASTRO_SYNC_TIMEOUT_MS || '300000',
  10
);

let syncInFlight = null;

function scriptPath() {
  return (
    process.env.CADASTRO_SYNC_SCRIPT ||
    path.join(__dirname, '../../../sync_cadastros_mysql.py')
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

function mapSyncRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    sincronizado_em: row.sincronizado_em,
    erro: row.erro,
    estabelecimentos: {
      inserted: row.estab_inseridos,
      updated: row.estab_atualizados,
      inactivated: row.estab_inativados,
    },
    procedimentos: {
      inserted: row.proc_inseridos,
      updated: row.proc_atualizados,
      inactivated: row.proc_inativados,
    },
    formas: {
      inserted: row.forma_inseridos ?? 0,
      updated: row.forma_atualizados ?? 0,
      inactivated: row.forma_inativados ?? 0,
    },
    cbos: {
      inserted: row.cbo_inseridos ?? 0,
      updated: row.cbo_atualizados ?? 0,
      inactivated: row.cbo_inativados ?? 0,
    },
    rubricas: {
      inserted: row.rubrica_inseridos ?? 0,
      updated: row.rubrica_atualizados ?? 0,
      inactivated: row.rubrica_inativados ?? 0,
    },
  };
}

function runSyncSubprocess() {
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const proc = spawn(pythonBin(), [script, '--pg-write'], {
      cwd: path.dirname(script),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (handler, value) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      handler(value);
    };

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      const error = new Error('Timeout do sync de cadastros');
      error.status = 504;
      finish(reject, error);
    }, SYNC_TIMEOUT_MS);

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => finish(reject, err));

    proc.on('close', (code) => {
      try {
        const result = parseSyncOutput(stdout);
        if (result && typeof result.status === 'string') {
          finish(resolve, result);
          return;
        }
      } catch (_err) {
        // fall through to exit-code handling
      }

      if (code !== 0) {
        const error = new Error(
          stderr.trim() || `sync_cadastros_mysql exit ${code}`
        );
        error.status = 502;
        error.details = stderr.trim();
        finish(reject, error);
        return;
      }

      const error = new Error('Saída vazia do sync de cadastros');
      error.status = 502;
      finish(reject, error);
    });
  });
}

async function sincronizar() {
  if (syncInFlight) {
    const error = new Error('Sincronização de cadastros já em andamento');
    error.status = 409;
    throw error;
  }

  const promise = runSyncSubprocess();
  syncInFlight = promise;

  try {
    return await promise;
  } finally {
    if (syncInFlight === promise) {
      syncInFlight = null;
    }
  }
}

function _resetSyncLockForTests() {
  syncInFlight = null;
}

async function listSyncHistory({ page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const countResult = await query(
    'SELECT COUNT(*)::int AS total FROM cadastros_sincronizacoes'
  );
  const total = countResult.rows[0].total;

  const { rows } = await query(
    `SELECT id, status,
            estab_inseridos, estab_atualizados, estab_inativados,
            proc_inseridos, proc_atualizados, proc_inativados,
            forma_inseridos, forma_atualizados, forma_inativados,
            cbo_inseridos, cbo_atualizados, cbo_inativados,
            rubrica_inseridos, rubrica_atualizados, rubrica_inativados,
            erro, sincronizado_em
     FROM cadastros_sincronizacoes
     ORDER BY sincronizado_em DESC
     LIMIT $1 OFFSET $2`,
    [safeLimit, offset]
  );

  return {
    data: rows.map(mapSyncRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.ceil(total / safeLimit) || 1,
    },
  };
}

async function getLatestSync() {
  const { rows } = await query(
    `SELECT id, status,
            estab_inseridos, estab_atualizados, estab_inativados,
            proc_inseridos, proc_atualizados, proc_inativados,
            forma_inseridos, forma_atualizados, forma_inativados,
            cbo_inseridos, cbo_atualizados, cbo_inativados,
            rubrica_inseridos, rubrica_atualizados, rubrica_inativados,
            erro, sincronizado_em
     FROM cadastros_sincronizacoes
     WHERE status = 'ok'
     ORDER BY sincronizado_em DESC
     LIMIT 1`
  );

  if (!rows.length) {
    const error = new Error('Nenhuma sincronização bem-sucedida encontrada');
    error.status = 404;
    throw error;
  }

  return mapSyncRow(rows[0]);
}

module.exports = {
  sincronizar,
  parseSyncOutput,
  scriptPath,
  pythonBin,
  listSyncHistory,
  getLatestSync,
  mapSyncRow,
  _resetSyncLockForTests,
};
