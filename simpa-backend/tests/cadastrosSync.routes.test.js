jest.mock('../src/services/db');
jest.mock('../src/services/cadastrosSync');
jest.mock('../src/services/auditService');
jest.mock('../src/services/estabelecimentosService');

const request = require('supertest');
const { query } = require('../src/services/db');
const {
  sincronizar,
  listSyncHistory,
  getLatestSync,
} = require('../src/services/cadastrosSync');
const { listEstabelecimentos, getEstabelecimentoById } = require('../src/services/estabelecimentosService');
const { logAudit } = require('../src/services/auditService');
const { authHeader, unidadeHeader } = require('./helpers/auth');
const app = require('../src/app');

describe('cadastros sync routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
    logAudit.mockResolvedValue(undefined);
    sincronizar.mockResolvedValue({
      status: 'ok',
      estabelecimentos: { inserted: 2, updated: 5, inactivated: 0 },
      procedimentos: { inserted: 10, updated: 20, inactivated: 1 },
      sincronizado_em: '2026-06-20T12:00:00Z',
    });
    listSyncHistory.mockResolvedValue({
      data: [
        {
          id: 1,
          status: 'ok',
          sincronizado_em: '2026-06-20T12:00:00Z',
          estabelecimentos: { inserted: 2, updated: 5, inactivated: 0 },
          procedimentos: { inserted: 10, updated: 20, inactivated: 1 },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    getLatestSync.mockResolvedValue({
      id: 1,
      status: 'ok',
      sincronizado_em: '2026-06-20T12:00:00Z',
      estabelecimentos: { inserted: 2, updated: 5, inactivated: 0 },
      procedimentos: { inserted: 10, updated: 20, inactivated: 1 },
    });
    getEstabelecimentoById.mockRejectedValue(
      Object.assign(new Error('Estabelecimento não encontrado'), { status: 404 })
    );
  });

  it('POST /sincronizar triggers sync and returns counts', async () => {
    const res = await request(app)
      .post('/api/cadastros/sincronizar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.estabelecimentos.inserted).toBe(2);
    expect(sincronizar).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'cadastros_sincronizar',
        recurso: 'cadastros',
      })
    );
  });

  it('POST /sincronizar skips audit on erro status', async () => {
    sincronizar.mockResolvedValueOnce({
      status: 'erro',
      error: 'MySQL_XAMPP_UNAVAILABLE',
      estabelecimentos: { inserted: 0, updated: 0, inactivated: 0 },
      procedimentos: { inserted: 0, updated: 0, inactivated: 0 },
    });

    const res = await request(app)
      .post('/api/cadastros/sincronizar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('erro');
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('POST /sincronizar maps subprocess failure to 502', async () => {
    const err = new Error('MySQL connection refused');
    err.status = 502;
    sincronizar.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/cadastros/sincronizar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/connection refused/i);
  });

  it('GET /sincronizacoes lists paginated history', async () => {
    const res = await request(app)
      .get('/api/cadastros/sincronizacoes')
      .query({ page: 1, limit: 10 })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
    expect(listSyncHistory).toHaveBeenCalledWith({ page: '1', limit: '10' });
  });

  it('GET /sincronizacoes propagates service errors', async () => {
    const err = new Error('db down');
    err.status = 500;
    listSyncHistory.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/sincronizacoes')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  it('GET /sincronizacoes/ultima returns latest ok sync', async () => {
    const res = await request(app)
      .get('/api/cadastros/sincronizacoes/ultima')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(getLatestSync).toHaveBeenCalledTimes(1);
  });

  it('GET /sincronizacoes/ultima propagates 404 when none found', async () => {
    const err = new Error('Nenhuma sincronização bem-sucedida encontrada');
    err.status = 404;
    getLatestSync.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/sincronizacoes/ultima')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('GET /estabelecimentos/:id propagates service errors', async () => {
    const err = new Error('Estabelecimento não encontrado');
    err.status = 404;
    getEstabelecimentoById.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/estabelecimentos/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('GET /estabelecimentos propagates list errors', async () => {
    const err = new Error('db down');
    err.status = 500;
    listEstabelecimentos.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/estabelecimentos')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  it('POST /sincronizar then GET /estabelecimentos returns synced rows', async () => {
    listEstabelecimentos.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          codigo_externo: '1234567',
          nome: 'UBS Centro',
          perfil: 'APS',
          status: 'ativo',
          enriquecimento: {},
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    });

    const syncRes = await request(app)
      .post('/api/cadastros/sincronizar')
      .set('Authorization', authHeader());

    expect(syncRes.status).toBe(201);
    expect(syncRes.body.status).toBe('ok');

    const listRes = await request(app)
      .get('/api/cadastros/estabelecimentos')
      .set('Authorization', authHeader());

    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].codigo_externo).toBe('1234567');
    expect(listEstabelecimentos).toHaveBeenCalled();
  });

  it('POST /sincronizar returns 403 for non-planning profile', async () => {
    const res = await request(app)
      .post('/api/cadastros/sincronizar')
      .set('Authorization', unidadeHeader());

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permissão/i);
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('requires JWT', async () => {
    const res = await request(app).post('/api/cadastros/sincronizar');
    expect(res.status).toBe(401);
  });
});
