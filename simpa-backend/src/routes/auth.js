const express = require('express');
const verifyJWT = require('../middleware/verifyJWT');
const { authenticate, INVALID_CREDENTIALS } = require('../services/authService');
const { logAudit } = require('../services/auditService');

const router = express.Router();

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;
}

router.post('/login', async (req, res, next) => {
  try {
    const { username, senha } = req.body || {};

    if (!username || !senha) {
      return res.status(400).json({ error: 'username e senha são obrigatórios' });
    }

    const result = await authenticate(username, senha);
    const ip = clientIp(req);

    if (!result.ok) {
      await logAudit({
        usuarioId: result.user?.id || null,
        acao: 'login_failed',
        recurso: 'auth/login',
        detalhes: { username },
        ip,
      });
      return res.status(401).json({ error: INVALID_CREDENTIALS });
    }

    await logAudit({
      usuarioId: result.userId,
      acao: 'login_success',
      recurso: 'auth/login',
      detalhes: { username: result.user.username, perfil: result.user.perfil },
      ip,
    });

    return res.json({ token: result.token, user: result.user });
  } catch (err) {
    return next(err);
  }
});

router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

router.get('/me', verifyJWT, (req, res) => {
  res.json({
    username: req.user.username,
    nome: req.user.nome,
    perfil: req.user.perfil,
  });
});

module.exports = router;
