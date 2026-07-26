const jsonServer = require('json-server');
const path = require('path');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

// Rewrite API paths (query strings are ignored by req.path)
server.use((req, _res, next) => {
  const map = {
    '/api/importacao/cargas': '/cargas',
    '/api/cadastros/unidades': '/unidades',
    '/api/cadastros/equipes': '/equipes',
    '/api/v1/dashboard/planejamento': '/planejamento/2026-05_CAFI_EQ9',
  };
  if (map[req.path]) req.url = map[req.path];
  next();
});

server.use(middlewares);
server.use(router);

const PORT = 3100;
server.listen(PORT, () => {
  console.log(`JSON Server listening on http://localhost:${PORT}`);
});
