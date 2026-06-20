const path = require('path');
const fs = require('fs');
const jsonServer = require('json-server');

const PORT = Number(process.env.MOCK_PORT || 3100);
const HOST = process.env.MOCK_HOST || 'localhost';

const dbPath = path.join(__dirname, 'db.json');
const routesPath = path.join(__dirname, 'routes.json');

const server = jsonServer.create();
const router = jsonServer.router(dbPath);
const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));

server.use(jsonServer.defaults({ bodyParser: true }));
server.use(jsonServer.rewriter(routes));

server.post('/auth/login', (req, res) => {
  const { username, senha } = req.body || {};

  if (username === 'admin' && senha === 'simpa@2026') {
    return res.json({
      token: 'mock-jwt-token',
      user: {
        username: 'admin',
        nome: 'Administrador SIMPA',
        perfil: 'Administrador',
      },
    });
  }

  return res.status(401).json({ error: 'Credenciais inválidas' });
});

server.get('/auth/me', (req, res) => {
  const header = req.headers.authorization || '';

  if (header.includes('mock-jwt-token')) {
    return res.json({
      username: 'admin',
      nome: 'Administrador SIMPA',
      perfil: 'Administrador',
    });
  }

  return res.status(401).json({ error: 'Token ausente ou inválido' });
});

server.post('/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

server.use(router);

server.listen(PORT, HOST, () => {
  console.log(`SIMPA mock API listening on http://${HOST}:${PORT}`);
  console.log('Auth: POST /auth/login (admin / simpa@2026)');
});
