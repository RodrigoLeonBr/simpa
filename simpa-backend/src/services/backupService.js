const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
const { uploadsRoot } = require('./storage');

const BACKUP_DIR_NAME = 'backups';
const BACKUP_PREFIX = 'simpa-backup-';
const BACKUP_EXT = '.sql';
const BACKUP_FILENAME_RE = /^simpa-backup-[\dTZ-]+\.sql$/;
const RESTORE_CONFIRM = 'RESTAURAR';
const MAX_STORED = Math.max(1, parseInt(process.env.BACKUP_MAX_STORED || '10', 10));
const MAX_RESTORE_BYTES =
  Math.max(1, parseInt(process.env.BACKUP_MAX_RESTORE_MB || '500', 10)) * 1024 * 1024;

function backupDir() {
  return path.join(uploadsRoot(), BACKUP_DIR_NAME);
}

function ensureBackupDir() {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function pgEnv() {
  return {
    ...process.env,
    PGHOST: process.env.PG_HOST,
    PGPORT: process.env.PG_PORT || '5432',
    PGUSER: process.env.PG_USER,
    PGPASSWORD: process.env.PG_PASS,
    PGDATABASE: process.env.PG_DB,
  };
}

function timestampLabel(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function buildFilename(date = new Date()) {
  return `${BACKUP_PREFIX}${timestampLabel(date)}${BACKUP_EXT}`;
}

function safeBackupFilename(filename) {
  const base = path.basename(String(filename || ''));
  if (!BACKUP_FILENAME_RE.test(base)) {
    return null;
  }
  return base;
}

function resolveBackupPath(filename) {
  const safe = safeBackupFilename(filename);
  if (!safe) {
    return null;
  }
  const full = path.join(backupDir(), safe);
  if (!fs.existsSync(full)) {
    return null;
  }
  return full;
}

function commandExists(cmd) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['--version'], { env: pgEnv(), stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const errChunks = [];
    const proc = spawn(cmd, args, {
      env: pgEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    proc.stdout?.on('data', () => {});
    proc.stderr?.on('data', (chunk) => errChunks.push(chunk));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(errChunks).toString('utf8').trim();
        reject(new Error(detail || `${cmd} encerrou com código ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function runPgDumpToFile(filepath) {
  await runCommand('pg_dump', [
    '--no-owner',
    '--no-acl',
    '--clean',
    '--if-exists',
    '--format=plain',
    '--encoding=UTF8',
    '-f',
    filepath,
  ]);
}

async function runPsqlFile(filepath) {
  await runCommand('psql', ['-v', 'ON_ERROR_STOP=1', '-f', filepath]);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (value instanceof Date) {
    return `'${value.toISOString().replace(/'/g, "''")}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `'\\x${value.toString('hex')}'`;
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function listPublicTables(client) {
  const { rows } = await client.query(
    `SELECT tablename
     FROM pg_tables
     WHERE schemaname = 'public'
     ORDER BY tablename`
  );
  return rows.map((row) => row.tablename);
}

async function exportDataSql(client) {
  const tables = await listPublicTables(client);
  const lines = [
    '-- SIMPA backup (modo interno Node/pg)',
    `-- Gerado em: ${new Date().toISOString()}`,
    'BEGIN;',
    'SET session_replication_role = replica;',
  ];

  if (tables.length) {
    const quoted = tables.map((name) => `"${name.replace(/"/g, '""')}"`).join(', ');
    lines.push(`TRUNCATE ${quoted} CASCADE;`);
  }

  for (const table of tables) {
    const { rows } = await client.query(`SELECT * FROM "${table.replace(/"/g, '""')}"`);
    if (!rows.length) {
      continue;
    }
    const colNames = Object.keys(rows[0]);
    const columns = colNames.map((col) => `"${col.replace(/"/g, '""')}"`);
    for (const row of rows) {
      const values = colNames.map((col) => sqlLiteral(row[col]));
      lines.push(
        `INSERT INTO "${table.replace(/"/g, '""')}" (${columns.join(', ')}) VALUES (${values.join(', ')});`
      );
    }
  }

  for (const table of tables) {
    const { rows } = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_default LIKE 'nextval(%'`,
      [table]
    );
    for (const col of rows) {
      lines.push(
        `SELECT setval(pg_get_serial_sequence('"${table.replace(/"/g, '""')}"', '${col.column_name.replace(/'/g, "''")}'), COALESCE((SELECT MAX("${col.column_name.replace(/"/g, '""')}") FROM "${table.replace(/"/g, '""')}"), 1), true);`
      );
    }
  }

  lines.push('SET session_replication_role = DEFAULT;', 'COMMIT;', '');
  return lines.join('\n');
}

async function createBackupPureJs(filepath) {
  const client = await pool.connect();
  try {
    const sql = await exportDataSql(client);
    fs.writeFileSync(filepath, sql, 'utf8');
  } finally {
    client.release();
  }
}

async function restorePureJs(filepath) {
  const sql = fs.readFileSync(filepath, 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }
}

function statToMeta(filepath, filename) {
  const stat = fs.statSync(filepath);
  return {
    filename,
    size: stat.size,
    created_at: stat.mtime.toISOString(),
  };
}

function pruneOldBackups() {
  ensureBackupDir();
  const files = fs
    .readdirSync(backupDir())
    .filter((name) => BACKUP_FILENAME_RE.test(name))
    .map((name) => ({
      name,
      mtime: fs.statSync(path.join(backupDir(), name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const file of files.slice(MAX_STORED)) {
    fs.unlinkSync(path.join(backupDir(), file.name));
  }
}

async function createBackup() {
  ensureBackupDir();
  const filename = buildFilename();
  const filepath = path.join(backupDir(), filename);

  const hasPgDump = await commandExists('pg_dump');
  if (hasPgDump) {
    await runPgDumpToFile(filepath);
  } else {
    await createBackupPureJs(filepath);
  }

  pruneOldBackups();
  return statToMeta(filepath, filename);
}

function listBackups() {
  ensureBackupDir();
  return fs
    .readdirSync(backupDir())
    .filter((name) => BACKUP_FILENAME_RE.test(name))
    .map((name) => statToMeta(path.join(backupDir(), name), name))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function deleteBackup(filename) {
  const filepath = resolveBackupPath(filename);
  if (!filepath) {
    return false;
  }
  fs.unlinkSync(filepath);
  return true;
}

function assertRestoreSize(filepath) {
  const size = fs.statSync(filepath).size;
  if (size > MAX_RESTORE_BYTES) {
    throw new Error(`Arquivo excede o limite de ${MAX_RESTORE_BYTES / (1024 * 1024)} MB`);
  }
}

function assertRestoreConfirm(confirm) {
  if (String(confirm || '').trim() !== RESTORE_CONFIRM) {
    throw new Error(`Confirmação inválida. Digite ${RESTORE_CONFIRM} para continuar.`);
  }
}

async function restoreBackupFile(filepath) {
  assertRestoreSize(filepath);

  const hasPsql = await commandExists('psql');
  if (hasPsql) {
    await runPsqlFile(filepath);
    return { mode: 'psql' };
  }

  await restorePureJs(filepath);
  return { mode: 'node' };
}

async function restoreFromStored(filename, confirm) {
  assertRestoreConfirm(confirm);
  const filepath = resolveBackupPath(filename);
  if (!filepath) {
    throw new Error('Backup não encontrado');
  }
  return restoreBackupFile(filepath);
}

async function restoreFromUpload(tempPath, confirm) {
  assertRestoreConfirm(confirm);
  return restoreBackupFile(tempPath);
}

module.exports = {
  RESTORE_CONFIRM,
  backupDir,
  buildFilename,
  safeBackupFilename,
  resolveBackupPath,
  createBackup,
  listBackups,
  deleteBackup,
  restoreFromStored,
  restoreFromUpload,
};
