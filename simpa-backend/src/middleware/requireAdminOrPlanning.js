function requireAdminOrPlanning(req, res, next) {
  const perfil = req.user?.perfil;
  if (perfil === 'Administrador' || perfil === 'Planejamento') {
    return next();
  }
  return res.status(403).json({ error: 'Acesso restrito a Administrador ou Planejamento' });
}

module.exports = requireAdminOrPlanning;
