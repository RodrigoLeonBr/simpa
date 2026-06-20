jest.mock('../src/services/dashboardService');
jest.mock('../src/services/consolidator');

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { fetchDashboard } = require('../src/services/dashboardService');
const { runConsolidation } = require('../src/services/consolidator');
const { samplePayload } = require('./fixtures/sampleContrato');
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

describe('dashboard routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /planejamento requires competencia', async () => {
    fetchDashboard.mockResolvedValueOnce({
      status: 400,
      body: { error: 'parâmetro competencia obrigatório (YYYY-MM)' },
    });

    const res = await request(app)
      .get('/api/v1/dashboard/planejamento')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(fetchDashboard).toHaveBeenCalledWith({
      competencia: undefined,
      unidade: undefined,
      equipe: undefined,
    });
  });

  it('GET /planejamento returns dashboard payload', async () => {
    fetchDashboard.mockResolvedValueOnce({ status: 200, body: samplePayload });

    const res = await request(app)
      .get('/api/v1/dashboard/planejamento')
      .query({
        competencia: '2026-05',
        unidade: samplePayload.filtros_ativos.unidade,
        equipe: samplePayload.filtros_ativos.equipe,
      })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.versao_schema).toBe('3.1.0');
  });

  it('POST /consolidar validates parameters', async () => {
    const res = await request(app)
      .post('/api/v1/dashboard/consolidar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(runConsolidation).not.toHaveBeenCalled();
  });

  it('GET /planejamento forwards service errors', async () => {
    fetchDashboard.mockRejectedValueOnce(new Error('db timeout'));

    const res = await request(app)
      .get('/api/v1/dashboard/planejamento')
      .query({ competencia: '2026-05' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db timeout');
  });

  it('POST /consolidar forwards subprocess errors', async () => {
    const err = new Error('consolidate failed');
    err.status = 502;
    runConsolidation.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/v1/dashboard/consolidar')
      .query({ all: 'true' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('consolidate failed');
  });

  it('POST /consolidar with mocked subprocess succeeds', async () => {
    runConsolidation.mockResolvedValueOnce({
      ok: true,
      result: { status: 'ok', competencia: '2026-05' },
    });

    const res = await request(app)
      .post('/api/v1/dashboard/consolidar')
      .query({
        competencia: '2026-05',
        unidade: samplePayload.filtros_ativos.unidade,
        equipe: samplePayload.filtros_ativos.equipe,
      })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('ok');
    expect(runConsolidation).toHaveBeenCalledWith({
      competencia: '2026-05',
      unidade: samplePayload.filtros_ativos.unidade,
      equipe: samplePayload.filtros_ativos.equipe,
    });
  });

  it('POST /consolidar all=true triggers backfill', async () => {
    runConsolidation.mockResolvedValueOnce({ ok: true, result: [{ status: 'ok' }] });

    const res = await request(app)
      .post('/api/v1/dashboard/consolidar')
      .query({ all: 'true' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(runConsolidation).toHaveBeenCalledWith({ all: true });
  });
});
