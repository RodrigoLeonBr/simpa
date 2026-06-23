jest.mock('../src/services/db');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../src/services/db');
const app = require('../src/app');

function authHeader() {
  process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    { sub: 1, username: 'admin', nome: 'Admin', perfil: 'Administrador' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

// A complete populacao_cadastrada row returned by the service query
const seedRow = {
  estabelecimento_id: 5,
  estabelecimento_nome: 'PSF JD Alvorada',
  competencia: '2026-01-01',
  cidadaos_ativos: 3337,
  saidas: 1198,
  importado_em: '2026-06-22T14:30:00Z',
  faixa_etaria: [{ faixa: 'Menos de 01 ano', masculino: 20, feminino: 15 }],
  condicoes_saude: { gestante: { sim: 14, nao: 150, nao_informado: 1500 } },
  raca_cor: { branca: 1500 },
};

describe('GET /api/populacao', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Auth guard ──────────────────────────────────────────────────────────────

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/populacao').query({ competencia: '2026-01' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/token/i);
  });

  // ─── Validation ──────────────────────────────────────────────────────────────

  it('returns 400 when competencia param is missing', async () => {
    const res = await request(app)
      .get('/api/populacao')
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/competencia/i);
  });

  it('returns 400 when competencia format is invalid', async () => {
    const res = await request(app)
      .get('/api/populacao')
      .query({ competencia: '01-2026' })
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/competencia/i);
  });

  // ─── 404 when no data ────────────────────────────────────────────────────────

  it('returns 404 with error key when no data found', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/populacao')
      .query({ competencia: '2099-01' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/sem dados/i);
  });

  // ─── 200 with seeded data ────────────────────────────────────────────────────

  it('returns 200 with cidadaos_ativos when data exists', async () => {
    query.mockResolvedValueOnce({ rows: [seedRow] });

    const res = await request(app)
      .get('/api/populacao')
      .query({ competencia: '2026-01' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.total_cidadaos_ativos).toBe(3337);
    expect(res.body.total_cidadaos_ativos).toBeGreaterThan(0);
  });

  it('returns expected response shape', async () => {
    query.mockResolvedValueOnce({ rows: [seedRow] });

    const res = await request(app)
      .get('/api/populacao')
      .query({ competencia: '2026-01' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('competencia');
    expect(res.body).toHaveProperty('total_cidadaos_ativos');
    expect(res.body).toHaveProperty('total_saidas');
    expect(res.body).toHaveProperty('por_unidade');
    expect(res.body).toHaveProperty('faixa_etaria');
    expect(res.body).toHaveProperty('condicoes_saude');
    expect(res.body).toHaveProperty('raca_cor');
  });

  // ─── Single unit filter ──────────────────────────────────────────────────────

  it('returns por_unidade with length 1 when estabelecimento_id is provided', async () => {
    query.mockResolvedValueOnce({ rows: [seedRow] });

    const res = await request(app)
      .get('/api/populacao')
      .query({ competencia: '2026-01', estabelecimento_id: 5 })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.por_unidade).toHaveLength(1);
    expect(res.body.por_unidade[0].estabelecimento_id).toBe(5);
  });

  it('includes estabelecimento_nome in por_unidade entry', async () => {
    query.mockResolvedValueOnce({ rows: [seedRow] });

    const res = await request(app)
      .get('/api/populacao')
      .query({ competencia: '2026-01', estabelecimento_id: 5 })
      .set('Authorization', authHeader());

    expect(res.body.por_unidade[0].estabelecimento_nome).toBe('PSF JD Alvorada');
  });
});

describe('GET /api/populacao/competencias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/populacao/competencias');
    expect(res.status).toBe(401);
  });

  it('returns 200 with array (may be empty)', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/populacao/competencias')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns array with competencia entries when data exists', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { competencia: '2026-03', unidades_count: '2', total_cidadaos_ativos: '8000' },
        { competencia: '2026-01', unidades_count: '3', total_cidadaos_ativos: '10173' },
      ],
    });

    const res = await request(app)
      .get('/api/populacao/competencias')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('competencia');
    expect(res.body[0]).toHaveProperty('unidades_count');
    expect(res.body[0]).toHaveProperty('total_cidadaos_ativos');
  });

  it('returns entries sorted descending by competencia', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { competencia: '2026-03', unidades_count: '2', total_cidadaos_ativos: '8000' },
        { competencia: '2026-01', unidades_count: '3', total_cidadaos_ativos: '10173' },
      ],
    });

    const res = await request(app)
      .get('/api/populacao/competencias')
      .set('Authorization', authHeader());

    expect(res.body[0].competencia).toBe('2026-03');
    expect(res.body[1].competencia).toBe('2026-01');
  });
});
