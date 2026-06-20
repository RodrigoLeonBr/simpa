jest.mock('../src/services/db');
jest.mock('../src/services/sia');
jest.mock('../src/services/consolidator');

const request = require('supertest');
const { query } = require('../src/services/db');
const { sincronizar } = require('../src/services/sia');
const { runConsolidation } = require('../src/services/consolidator');
const { authHeader } = require('./helpers/auth');
const app = require('../src/app');

describe('sia routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
    sincronizar.mockResolvedValue({
      sincronizacao_id: 1,
      competencia: '2026-05-01',
      registros: 5,
      erros: 0,
      status: 'ok',
    });
    runConsolidation.mockResolvedValue({ ok: true, result: { status: 'ok' } });
  });

  it('POST /sincronizar validates competencia', async () => {
    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: 'invalid' });

    expect(res.status).toBe(400);
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('POST /sincronizar triggers sync and consolidation', async () => {
    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2026-05' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.consolidacao.ok).toBe(true);
    expect(sincronizar).toHaveBeenCalledWith('2026-05');
    expect(runConsolidation).toHaveBeenCalledWith({ all: true });
  });

  it('POST /sincronizar skips consolidation on erro status', async () => {
    sincronizar.mockResolvedValueOnce({
      competencia: '2026-05',
      registros: 0,
      erros: 1,
      status: 'erro',
      error: 'MySQL_XAMPP_UNAVAILABLE',
    });

    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2026-05' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('erro');
    expect(res.body.consolidacao).toBeNull();
    expect(runConsolidation).not.toHaveBeenCalled();
  });

  it('POST /sincronizar keeps sync result when consolidation fails', async () => {
    runConsolidation.mockRejectedValueOnce(new Error('consolidate failed'));

    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2026-05' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.consolidacao).toEqual({
      ok: false,
      error: 'consolidate failed',
    });
  });

  it('POST /sincronizar consolidates on parcial status', async () => {
    sincronizar.mockResolvedValueOnce({
      competencia: '2026-05-01',
      registros: 3,
      erros: 1,
      status: 'parcial',
    });

    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2026-05' });

    expect(res.status).toBe(201);
    expect(runConsolidation).toHaveBeenCalledWith({ all: true });
  });

  it('GET /sincronizacoes lists history', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, competencia: '2026-05-01', status: 'ok', registros: 5 }],
    });

    const res = await request(app)
      .get('/api/sia/sincronizacoes')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('ok');
  });

  it('GET /producao applies filters', async () => {
    query.mockResolvedValueOnce({
      rows: [{ codigo_sigtap: '0301010072', quantidade: '12' }],
    });

    const res = await request(app)
      .get('/api/sia/producao')
      .query({ competencia: '2026-05', unidade: 'CAFI', codigo_sigtap: '0301010072' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body[0].codigo_sigtap).toBe('0301010072');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM sia_producao'),
      ['2026-05-01', '%CAFI%', '0301010072']
    );
  });

  it('requires JWT', async () => {
    const res = await request(app).get('/api/sia/sincronizacoes');
    expect(res.status).toBe(401);
  });
});
