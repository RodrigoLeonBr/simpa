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

server.get('/api/v1/dashboard/planejamento', (req, res) => {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const competencia = String(req.query.competencia || '2026-05');
  const unidade = req.query.unidade ? String(req.query.unidade) : null;
  const equipe = req.query.equipe ? String(req.query.equipe) : null;

  const item =
    db.planejamento.find((row) => {
      if (row.competencia !== competencia) return false;
      if (unidade && row.filtros_ativos?.unidade !== unidade) return false;
      if (equipe && row.filtros_ativos?.equipe !== equipe) return false;
      return true;
    }) || db.planejamento.find((row) => row.competencia === competencia);

  if (!item) {
    return res.status(404).json({
      error: 'Dados não encontrados para os filtros informados',
      filtros: { competencia, unidade, equipe },
    });
  }

  return res.json(item);
});

function readDb() {
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`);
}

function previewFromFilename(name) {
  return {
    nome: name,
    tipo_relatorio: 'atendimento_individual',
    competencia: '2026-05',
    unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
    equipe_nome: 'EQUIPE 9 EAP',
    ja_importado: false,
  };
}

server.post('/api/importacao/preview', (_req, res) => {
  const db = readDb();
  const preview = previewFromFilename('upload.csv');
  const jaImportado = db.cargas.some(
    (carga) =>
      carga.tipo_relatorio === preview.tipo_relatorio &&
      String(carga.competencia).startsWith(preview.competencia) &&
      carga.unidade === preview.unidade &&
      carga.equipe_nome === preview.equipe_nome,
  );
  return res.json([{ ...preview, ja_importado: jaImportado }]);
});

server.post('/api/importacao/upload', (_req, res) => {
  const db = readDb();
  const preview = previewFromFilename('upload.csv');
  const row = {
    id: Date.now(),
    tipo_relatorio: preview.tipo_relatorio,
    competencia: `${preview.competencia}-01`,
    unidade: preview.unidade,
    equipe_nome: preview.equipe_nome,
    arquivo_origem: preview.nome,
    registros_identificados: 540,
    registros_nao_identificados: 0,
    importado_em: new Date().toISOString(),
  };
  db.cargas.unshift(row);
  writeDb(db);
  return res.status(201).json([{ carga_id: row.id, status: 'ok', arquivo: preview.nome }]);
});

server.post('/api/importacao/:id/reprocessar', (req, res) => {
  return res.json({ status: 'ok', carga_id: Number(req.params.id) });
});

server.put('/api/importacao/:id/substituir', (req, res) => {
  return res.json({ status: 'ok', carga_id: Number(req.params.id) });
});

server.delete('/api/importacao/:id', (req, res) => {
  const db = readDb();
  db.cargas = db.cargas.filter((carga) => carga.id !== Number(req.params.id));
  writeDb(db);
  return res.json({ deleted: true, id: Number(req.params.id) });
});

server.get('/api/cadastros/estabelecimentos', (req, res) => {
  const db = readDb();
  let rows = db.estabelecimentos || [];
  const perfil = req.query.perfil ? String(req.query.perfil) : null;
  const status = req.query.status ? String(req.query.status) : 'ativo';

  if (perfil) {
    rows = rows.filter((row) => row.perfil === perfil);
  }
  if (status !== 'all') {
    rows = rows.filter((row) => row.status === status);
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const total = rows.length;
  const offset = (page - 1) * limit;
  const data = rows.slice(offset, offset + limit);

  return res.json({
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  });
});

server.use(router);

server.listen(PORT, HOST, () => {
  console.log(`SIMPA mock API listening on http://${HOST}:${PORT}`);
  console.log('Auth: POST /auth/login (admin / simpa@2026)');
});
