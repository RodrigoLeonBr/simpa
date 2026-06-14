const { spawn } = require('child_process');
const path       = require('path');

const PYTHON = process.env.PYTHON_BIN || 'python';
const SCRIPT = path.join(__dirname, '../../../sync_sia_mysql.py');

function sincronizar(competencia) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [SCRIPT, '--competencia', competencia, '--json-out']);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`sync_sia saiu com código ${code}: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON inválido do sync_sia: ${stdout.substring(0, 200)}`));
      }
    });
  });
}

module.exports = { sincronizar };
