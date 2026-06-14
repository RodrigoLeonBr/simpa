const { spawn } = require('child_process');
const path       = require('path');

const PYTHON = process.env.PYTHON_BIN || 'python';
const PARSER = path.join(__dirname, '../../../parse_esus_csv.py');

function runParser(csvPath, flag) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [PARSER, csvPath, flag]);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`parser saiu com código ${code}: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject(new Error(`JSON inválido do parser: ${stdout.substring(0, 200)}`));
      }
    });
  });
}

const preview   = (csvPath) => runParser(csvPath, '--json-out');
const processar = (csvPath) => runParser(csvPath, '--pg-write');

module.exports = { preview, processar };
