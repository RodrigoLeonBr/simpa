const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function uploadsRoot() {
  return process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
}

function competenciaParts(competencia) {
  const label = String(competencia).slice(0, 7);
  const [ano, mes] = label.split('-');
  if (!ano || !mes) {
    throw new Error('competencia inválida — use YYYY-MM');
  }
  return { label, ano, mes };
}

function slugUnidade(unidade) {
  return String(unidade || 'sem_unidade')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 60);
}

/**
 * uploads/esus/{ano}/{mes}/{unidade_slug}/{filename}
 */
function buildPath(competencia, unidade, filename) {
  const { ano, mes } = competenciaParts(competencia);
  const slug = slugUnidade(unidade);
  return path.join(uploadsRoot(), 'esus', ano, mes, slug, filename);
}

function hashFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function moveFile(tmpPath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  try {
    fs.renameSync(tmpPath, destPath);
  } catch (err) {
    // Windows: multer temp dir (often C:) and UPLOAD_DIR may live on another drive.
    if (err.code === 'EXDEV') {
      fs.copyFileSync(tmpPath, destPath);
      fs.unlinkSync(tmpPath);
      return;
    }
    throw err;
  }
}

function removeFile(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (_err) {
    // ignore missing files
  }
}

function removeTempFile(filePath) {
  if (filePath) {
    removeFile(filePath);
  }
}

module.exports = {
  uploadsRoot,
  buildPath,
  competenciaParts,
  hashFile,
  moveFile,
  removeFile,
  removeTempFile,
  slugUnidade,
};
