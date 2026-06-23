jest.mock('../src/services/db');
jest.mock('../src/services/sia');
jest.mock('../src/services/consolidator');
jest.mock('../src/services/siaProducaoService');

const request = require('supertest');
const { query } = require('../src/services/db');
const { sincronizar } = require('../src/services/sia');
const { runConsolidation } = require('../src/services/consolidator');
const { listProducao } = require('../src/services/siaProducaoService');
const { authHeader, unidadeHeader } = require('./helpers/auth');
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

  it('POST /sincronizar blocks non-planning profile', async () => {
    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', unidadeHeader())
      .send({ competencia: '2026-05' });

    expect(res.status).toBe(403);
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('POST /sincronizar returns 409 when competencia already imported', async () => {
    query.mockResolvedValueOnce({
      rows: [{ status: 'ok', registros: 99, sincronizado_em: '2026-06-22T00:00:00Z' }],
    });

    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2026-05' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      code: 'SIA_COMPETENCIA_JA_IMPORTADA',
      competencia: '2026-05',
      sincronizado_em: '2026-06-22T00:00:00Z',
      registros: 99,
    });
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('POST /sincronizar triggers sync and consolidation', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2026-05' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.consolidacao.ok).toBe(true);
    expect(sincronizar).toHaveBeenCalledWith('2026-05', { reimportar: false });
    expect(runConsolidation).toHaveBeenCalledWith({ all: true });
  });

  it('POST /sincronizar passes reimportar=true to service', async () => {
    query.mockResolvedValueOnce({
      rows: [{ status: 'ok', registros: 12, sincronizado_em: '2026-06-22T00:00:00Z' }],
    });

    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2026-05', reimportar: true });

    expect(res.status).toBe(201);
    expect(sincronizar).toHaveBeenCalledWith('2026-05', { reimportar: true });
  });

  it('POST /sincronizar skips consolidation on erro status', async () => {
    sincronizar.mockResolvedValueOnce({
      competencia: '2026-05',
      registros: 0,
      erros: 1,
      status: 'erro',
      error: 'MySQL_XAMPP_UNAVAILABLE',
    });
    query.mockResolvedValueOnce({ rows: [] });

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
    query.mockResolvedValueOnce({ rows: [] });

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
    query.mockResolvedValueOnce({ rows: [] });

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

  it('GET /sincronizacoes/existe returns exists=true', async () => {
    query.mockResolvedValueOnce({
      rows: [{ status: 'ok', registros: 7, sincronizado_em: '2026-06-22T10:00:00Z' }],
    });

    const res = await request(app)
      .get('/api/sia/sincronizacoes/existe')
      .query({ competencia: '2026-05' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      competencia: '2026-05',
      exists: true,
      status: 'ok',
      registros: 7,
      sincronizado_em: '2026-06-22T10:00:00Z',
    });
  });

  it('GET /sincronizacoes/existe validates competencia', async () => {
    const res = await request(app)
      .get('/api/sia/sincronizacoes/existe')
      .query({ competencia: '202605' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  it('GET /producao applies filters and returns enriched payload', async () => {
    listProducao.mockResolvedValueOnce([
      {
        codigo_sigtap: '0301010072',
        quantidade: '12',
        quantidade_apresentada: '14',
        valor_apresentado: '150.00',
        descricao_forma: 'CONSULTA MEDICA',
        descricao_cbo: 'MEDICO CLINICO',
      },
    ]);

    const res = await request(app)
      .get('/api/sia/producao')
      .query({
        competencia: '2026-05',
        unidade: 'CAFI',
        codigo_sigtap: '0301010072',
        estabelecimento_id: '42',
      })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body[0].codigo_sigtap).toBe('0301010072');
    expect(res.body[0].descricao_forma).toBe('CONSULTA MEDICA');
    expect(res.body[0].descricao_cbo).toBe('MEDICO CLINICO');
    expect(res.body[0].quantidade_apresentada).toBe('14');
    expect(res.body[0].valor_apresentado).toBe('150.00');
    expect(listProducao).toHaveBeenCalledWith({
      competencia: '2026-05',
      unidade: 'CAFI',
      codigo_sigtap: '0301010072',
      estabelecimento_id: '42',
    });
  });

  it('requires JWT', async () => {
    const res = await request(app).get('/api/sia/sincronizacoes');
    expect(res.status).toBe(401);
  });
});
