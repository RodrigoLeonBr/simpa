const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('./db');

const INVALID_CREDENTIALS = 'Credenciais inválidas';

function jwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '8h';
}

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET não configurado');
  }
  return secret;
}

async function findUserByUsername(username) {
  const result = await query(
    `SELECT id, username, senha_hash, nome, perfil, ativo
     FROM usuarios
     WHERE username = $1`,
    [username]
  );
  return result.rows[0] || null;
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      nome: user.nome,
      perfil: user.perfil,
    },
    jwtSecret(),
    { expiresIn: jwtExpiresIn() }
  );
}

function toPublicUser(user) {
  return {
    username: user.username,
    nome: user.nome,
    perfil: user.perfil,
  };
}

async function authenticate(username, senha) {
  const user = await findUserByUsername(username);
  if (!user || !user.ativo) {
    return { ok: false, user: null };
  }

  const valid = await verifyPassword(senha, user.senha_hash);
  if (!valid) {
    return { ok: false, user };
  }

  await query('UPDATE usuarios SET ultimo_login = now() WHERE id = $1', [user.id]);

  return {
    ok: true,
    token: signToken(user),
    user: toPublicUser(user),
    userId: user.id,
  };
}

module.exports = {
  INVALID_CREDENTIALS,
  authenticate,
  findUserByUsername,
  jwtExpiresIn,
  jwtSecret,
  signToken,
  toPublicUser,
  verifyPassword,
};
