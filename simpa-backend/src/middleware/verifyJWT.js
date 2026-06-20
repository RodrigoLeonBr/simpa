const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../services/authService');

function verifyJWT(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({ error: 'Token ausente ou inválido' });
  }

  try {
    const decoded = jwt.verify(match[1], jwtSecret());
    req.user = {
      id: decoded.sub,
      username: decoded.username,
      nome: decoded.nome,
      perfil: decoded.perfil,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: 'Token ausente ou inválido' });
  }
}

module.exports = verifyJWT;
