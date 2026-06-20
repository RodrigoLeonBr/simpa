const { spawn } = require('child_process');
const path = require('path');

function scriptPath() {
  return (
    process.env.PARSER_SCRIPT || path.join(__dirname, '../../../parse_esus_csv.py')
  );
}

function pythonBin() {
  return process.env.PYTHON_BIN || 'python3';
}

function runParser(csvPath, flag) {
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const proc = spawn(pythonBin(), [script, csvPath, flag], {
      cwd: path.dirname(script),
      env: { ...process.env },
    });

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
        const error = new Error(stderr.trim() || `parse_esus_csv exit ${code}`);
        error.status = 422;
        error.details = stderr.trim();
        reject(error);
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve([]);
        return;
      }

      try {
        const parsed = JSON.parse(trimmed);
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (_err) {
        const error = new Error('Saída JSON inválida do parser');
        error.status = 502;
        error.details = trimmed.slice(0, 200);
        reject(error);
      }
    });
  });
}

const preview = (csvPath) => runParser(csvPath, '--json-out');
const processar = (csvPath) => runParser(csvPath, '--pg-write');

module.exports = {
  preview,
  processar,
  runParser,
  scriptPath,
  pythonBin,
};
