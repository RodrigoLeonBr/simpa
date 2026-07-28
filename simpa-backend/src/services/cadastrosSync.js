const { spawn } = require('child_process');
const path = require('path');
const { query, pool } = require('./db');

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

function runSyncSubprocess(extraArgs = []) {
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const proc = spawn(pythonBin(), [script, '--pg-write', ...extraArgs], {
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

function parsePlanOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    const error = new Error('Saída vazia do plano de sync');
    error.status = 502;
    throw error;
  }
  const parsed = JSON.parse(trimmed);
  if (parsed.status === 'erro') {
    const error = new Error(parsed.erro || 'Erro ao planejar sync');
    error.status = 502;
    throw error;
  }
  return parsed;
}

function runPlanSubprocess() {
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const proc = spawn(pythonBin(), [script, '--plan'], {
      cwd: path.dirname(script),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      handler(value);
    };

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      const error = new Error('Timeout do plano de sync');
      error.status = 504;
      finish(reject, error);
    }, SYNC_TIMEOUT_MS);

    proc.stdout.on('data', (c) => { stdout += c.toString(); });
    proc.stderr.on('data', (c) => { stderr += c.toString(); });
    proc.on('error', (err) => finish(reject, err));
    proc.on('close', (code) => {
      try {
        return finish(resolve, parsePlanOutput(stdout));
      } catch (err) {
        if (code !== 0) {
          const e = new Error(stderr.trim() || `sync --plan exit ${code}`);
          e.status = 502;
          return finish(reject, e);
        }
        return finish(reject, err);
      }
    });
  });
}

async function planejarSync() {
  if (syncInFlight) {
    const error = new Error('Sincronização já em andamento');
    error.status = 409;
    throw error;
  }
  const promise = runPlanSubprocess();
  syncInFlight = promise;
  try {
    return await promise;
  } finally {
    if (syncInFlight === promise) syncInFlight = null;
  }
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

async function sincronizarReferencias() {
  if (syncInFlight) {
    const error = new Error('Sincronização de cadastros já em andamento');
    error.status = 409;
    throw error;
  }

  const promise = runSyncSubprocess(['--refs-only']);
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

const APLICAR_TABELAS = {
  estabelecimento: { tabela: 'estabelecimentos', chaveCol: 'codigo_externo' },
  procedimento: { tabela: 'procedimentos', chaveCol: 'codigo_sigtap' },
};

// Allowlist de colunas por entidade — o nome da coluna NUNCA vem cru do cliente.
const CAMPOS_PERMITIDOS = {
  estabelecimento: ['nome', 'cnpj', 're_tipo', 'tipouni', 'perfil', 'area', 'relatorio', 'status'],
  procedimento: ['descricao', 'pa_total', 'rubrica', 'pa_id', 'financiamento', 'status'],
};

async function _clobberOk(client, tabela, chaveCol, chave, diff, permitidos) {
  const campos = Object.keys(diff).filter((c) => permitidos.includes(c) && 'simpa' in diff[c]);
  if (campos.length === 0) return true;
  const { rows } = await client.query(
    `SELECT ${campos.join(', ')} FROM ${tabela} WHERE ${chaveCol} = $1`,
    [chave]
  );
  if (rows.length === 0) return false;
  // Compara normalizando p/ string: node-pg devolve NUMERIC como string e INT como number,
  // enquanto diff.simpa vem do plano Python (json.dumps default=str). O `===` cru daria
  // "clobber" falso por tipo diferente; um skip falso é seguro mas gera reprocesso desnecessário.
  return campos.every((c) => String(rows[0][c]) === String(diff[c].simpa));
}

async function aplicarPlano(itens, usuarioId) {
  const client = await pool.connect();
  let aplicados = 0;
  let pulados = 0;
  try {
    await client.query('BEGIN');
    for (const item of itens) {
      const cfg = APLICAR_TABELAS[item.entidade];
      if (!cfg) { pulados += 1; continue; }
      const permitidos = CAMPOS_PERMITIDOS[item.entidade];

      if (item.tipo === 'sumiu') {
        if (!(await _clobberOk(client, cfg.tabela, cfg.chaveCol, item.chave, item.diff, permitidos))) { pulados += 1; continue; }
        await client.query(
          `UPDATE ${cfg.tabela} SET status = 'inativo' WHERE ${cfg.chaveCol} = $1`,
          [item.chave]
        );
        aplicados += 1;
      } else if (item.tipo === 'alterado') {
        if (!(await _clobberOk(client, cfg.tabela, cfg.chaveCol, item.chave, item.diff, permitidos))) { pulados += 1; continue; }
        const campos = Object.keys(item.diff).filter((c) => permitidos.includes(c));
        if (campos.length === 0) { pulados += 1; continue; }
        const sets = campos.map((c, i) => `${c} = $${i + 2}`).join(', ');
        const vals = campos.map((c) => item.diff[c].mysql);
        await client.query(
          `UPDATE ${cfg.tabela} SET ${sets} WHERE ${cfg.chaveCol} = $1`,
          [item.chave, ...vals]
        );
        aplicados += 1;
      } else if (item.tipo === 'novo') {
        // ponytail: INSERT usa só os campos do diff. O plano Python (build_entity_plan)
        // sempre emite TODOS os compare_fields para 'novo' (inclui NOT NULL nome/descricao),
        // então o fluxo normal nunca viola NOT NULL. Um 'novo' parcial malformado abortaria
        // o batch inteiro (rollback atômico) — aceitável; adicionar guard 422 se virar problema.
        const campos = Object.keys(item.diff).filter((c) => permitidos.includes(c));
        const cols = [cfg.chaveCol, ...campos];
        const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
        const vals = [item.chave, ...campos.map((c) => item.diff[c].mysql)];
        await client.query(
          `INSERT INTO ${cfg.tabela} (${cols.join(', ')}) VALUES (${placeholders})
           ON CONFLICT (${cfg.chaveCol}) DO NOTHING`,
          vals
        );
        aplicados += 1;
      } else {
        pulados += 1;
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { aplicados, pulados };
}

module.exports = {
  sincronizar,
  sincronizarReferencias,
  planejarSync,
  aplicarPlano,
  parseSyncOutput,
  parsePlanOutput,
  scriptPath,
  pythonBin,
  listSyncHistory,
  getLatestSync,
  mapSyncRow,
  _resetSyncLockForTests,
};
