const { query } = require('./db');

async function logAudit({ usuarioId = null, acao, recurso = null, detalhes = null, ip = null }) {
  await query(
    `INSERT INTO audit_log (usuario_id, acao, recurso, detalhes, ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [usuarioId, acao, recurso, detalhes, ip]
  );
}

module.exports = { logAudit };
