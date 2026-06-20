module.exports = (req, res, next) => {
  if (req.method === 'POST' && req.path === '/auth/login') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (payload.username === 'admin' && payload.senha === 'simpa@2026') {
          res.json({
            token: 'mock-jwt-token',
            user: {
              username: 'admin',
              nome: 'Administrador SIMPA',
              perfil: 'Administrador',
            },
          });
          return;
        }
        res.status(401).json({ error: 'Credenciais inválidas' });
      } catch (_err) {
        res.status(400).json({ error: 'Requisição inválida' });
      }
    });
    return;
  }

  if (req.method === 'GET' && req.path === '/auth/me') {
    const header = req.headers.authorization || '';
    if (header.includes('mock-jwt-token')) {
      res.json({
        username: 'admin',
        nome: 'Administrador SIMPA',
        perfil: 'Administrador',
      });
      return;
    }
    res.status(401).json({ error: 'Token ausente ou inválido' });
    return;
  }

  if (req.method === 'POST' && req.path === '/auth/logout') {
    res.json({ ok: true });
    return;
  }

  next();
};
