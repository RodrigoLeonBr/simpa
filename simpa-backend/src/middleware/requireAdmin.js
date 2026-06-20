function requireAdmin(req, res, next) {
  if (req.user?.perfil !== 'Administrador') {
    return res.status(403).json({ error: 'Acesso restrito a Administrador' });
  }
  return next();
}

module.exports = requireAdmin;
