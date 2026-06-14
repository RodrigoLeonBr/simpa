const path = require('path');
const fs   = require('fs');

const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

function buildPath(competencia, unidade, filename) {
  const parts = String(competencia).split('-');
  const ano = parts[0];
  const mes = parts[1];
  const slug = unidade
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 60);
  return path.join(UPLOADS_ROOT, 'esus', ano, mes, slug, filename);
}

function moverArquivo(tmpPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.renameSync(tmpPath, destPath);
}

function removerArquivo(filePath) {
  try { fs.unlinkSync(filePath); } catch (_) {}
}

module.exports = { buildPath, moverArquivo, removerArquivo, UPLOADS_ROOT };
