const { spawn } = require('child_process');
const path       = require('path');

const PYTHON     = process.env.PYTHON_BIN || 'python';
const CONSOLIDAR = path.join(__dirname, '../../../consolidate_dashboard.py');

function runConsolidador(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [CONSOLIDAR, ...args]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`consolidador saiu com código ${code}: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON inválido do consolidador: ${stdout.substring(0, 200)}`));
      }
    });
  });
}

/** Normaliza competencia do parser (YYYY-MM-DD ou ISO) para YYYY-MM. */
function normalizarCompetencia(competencia) {
  if (!competencia) return null;
  const s = String(competencia);
  return s.length >= 7 ? s.slice(0, 7) : s;
}

function consolidar(competencia, unidade, equipe) {
  const comp = normalizarCompetencia(competencia);
  return runConsolidador([
    '--competencia', comp,
    '--unidade', unidade,
    '--equipe', equipe,
    '--pg-write',
  ]);
}

function consolidarCompetencia(competencia) {
  const comp = normalizarCompetencia(competencia);
  return runConsolidador(['--competencia', comp, '--competencia-only', '--pg-write']);
}

function consolidarTodos() {
  return runConsolidador(['--all', '--pg-write']);
}

module.exports = { consolidar, consolidarCompetencia, consolidarTodos, normalizarCompetencia };
