const ALLOWED_SYNC_PERFIS = [
  'Administrador',
  'Gestor Secretaria',
  'Planejamento',
];

function requirePlanningStaff(req, res, next) {
  if (!ALLOWED_SYNC_PERFIS.includes(req.user?.perfil)) {
    return res.status(403).json({
      error: 'Permissão insuficiente para sincronizar cadastros',
    });
  }

  return next();
}

module.exports = requirePlanningStaff;
module.exports.ALLOWED_SYNC_PERFIS = ALLOWED_SYNC_PERFIS;
