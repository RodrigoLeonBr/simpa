const { spawn } = require('child_process');
const path = require('path');

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

function sincronizar(competencia) {
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const proc = spawn(
      pythonBin(),
      [script, '--competencia', competencia, '--pg-write'],
      {
        cwd: path.dirname(script),
        env: { ...process.env },
      }
    );

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);

    proc.on('close', (code) => {
      if (code !== 0) {
        const error = new Error(stderr.trim() || `sync_sia_mysql exit ${code}`);
        error.status = 502;
        error.details = stderr.trim();
        reject(error);
        return;
      }

      try {
        const result = parseSyncOutput(stdout);
        if (!result) {
          const error = new Error('Saída vazia do sync SIA');
          error.status = 502;
          reject(error);
          return;
        }
        resolve(result);
      } catch (_err) {
        const error = new Error('Saída JSON inválida do sync SIA');
        error.status = 502;
        error.details = stdout.trim().slice(0, 200);
        reject(error);
      }
    });
  });
}

module.exports = { sincronizar, scriptPath, pythonBin, parseSyncOutput };
