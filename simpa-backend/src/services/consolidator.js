const { spawn } = require('child_process');
const path = require('path');

function scriptPath() {
  return (
    process.env.CONSOLIDATE_SCRIPT ||
    path.join(__dirname, '../../../consolidate_dashboard.py')
  );
}

function pythonBin() {
  return process.env.PYTHON_BIN || 'python3';
}

function buildConsolidationArgs({ all, competencia, unidade, equipe, estabelecimentoId, equipeId } = {}) {
  const args = [scriptPath(), '--pg-write'];

  if (all) {
    args.push('--all');
    return args;
  }

  args.push('--competencia', competencia);

  if (estabelecimentoId != null && equipeId != null) {
    args.push('--estabelecimento-id', String(estabelecimentoId));
    args.push('--equipe-id', String(equipeId));
    return args;
  }

  args.push('--unidade', unidade, '--equipe', equipe);
  return args;
}

function runConsolidation({
  all = false,
  competencia,
  unidade,
  equipe,
  estabelecimentoId,
  equipeId,
} = {}) {
  return new Promise((resolve, reject) => {
    const script = scriptPath();
    const proc = spawn(pythonBin(), buildConsolidationArgs({
      all,
      competencia,
      unidade,
      equipe,
      estabelecimentoId,
      equipeId,
    }), {
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
        const error = new Error(stderr.trim() || `consolidate_dashboard exit ${code}`);
        error.status = 502;
        error.details = stderr.trim();
        reject(error);
        return;
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        resolve({ ok: true, result: null });
        return;
      }

      try {
        resolve({ ok: true, result: JSON.parse(trimmed) });
      } catch (err) {
        const error = new Error('Saída JSON inválida do consolidador');
        error.status = 502;
        error.details = trimmed;
        reject(error);
      }
    });
  });
}

module.exports = {
  runConsolidation,
  buildConsolidationArgs,
  scriptPath,
  pythonBin,
};
