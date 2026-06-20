const { spawn } = require('child_process');
const path = require('path');

const REQUIRED_ENV = ['MYSQL_HOST', 'MYSQL_DB', 'MYSQL_USER', 'MYSQL_PASS'];

function repoRoot() {
  return path.join(__dirname, '../../..');
}

function pythonBin() {
  return process.env.PYTHON_BIN || 'python3';
}

function mysqlConfigured() {
  return REQUIRED_ENV.every((key) => Boolean(process.env[key]));
}

function probeMysql() {
  if (!mysqlConfigured()) {
    return Promise.resolve({ configured: false, status: 'not_configured' });
  }

  return new Promise((resolve) => {
    const probeCode =
      'from etl_db import mysql_connect; c=mysql_connect(); c.close()';
    const proc = spawn(pythonBin(), ['-c', probeCode], {
      cwd: repoRoot(),
      env: { ...process.env },
    });

    proc.on('error', () => {
      resolve({ configured: true, status: 'unavailable' });
    });

    proc.on('close', (code) => {
      resolve({
        configured: true,
        status: code === 0 ? 'connected' : 'unavailable',
      });
    });
  });
}

module.exports = { mysqlConfigured, probeMysql, pythonBin, repoRoot };
