const jwt = require('jsonwebtoken');

function authHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    { sub: 1, username: 'admin', nome: 'Admin', perfil: 'Administrador' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

module.exports = { authHeader };
