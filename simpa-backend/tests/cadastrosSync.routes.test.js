jest.mock('../src/services/db');
jest.mock('../src/services/cadastrosSync');
jest.mock('../src/services/auditService');
jest.mock('../src/services/estabelecimentosService');

const request = require('supertest');
const { query } = require('../src/services/db');
const {
  sincronizarReferencias,
  planejarSync,
  aplicarPlano,
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
    planejarSync.mockResolvedValue({
      status: 'ok',
      estabelecimentos: [],
      procedimentos: [],
      resumo: { estabelecimentos: { novo: 0, alterado: 0, sumiu: 0 }, procedimentos: { novo: 0, alterado: 0, sumiu: 0 } },
      sincronizado_em: '2026-07-28T12:00:00Z',
    });
    aplicarPlano.mockResolvedValue({ aplicados: 0, pulados: 0 });
    sincronizarReferencias.mockResolvedValue({
      status: 'ok',
      estabelecimentos: { inserted: 0, updated: 0, inactivated: 0 },
      procedimentos: { inserted: 0, updated: 0, inactivated: 0 },
      formas: { inserted: 3, updated: 4, inactivated: 0 },
      cbos: { inserted: 5, updated: 6, inactivated: 0 },
      rubricas: { inserted: 7, updated: 8, inactivated: 0 },
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
          formas: { inserted: 3, updated: 4, inactivated: 0 },
          cbos: { inserted: 5, updated: 6, inactivated: 0 },
          rubricas: { inserted: 7, updated: 8, inactivated: 0 },
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
      formas: { inserted: 3, updated: 4, inactivated: 0 },
      cbos: { inserted: 5, updated: 6, inactivated: 0 },
      rubricas: { inserted: 7, updated: 8, inactivated: 0 },
    });
    getEstabelecimentoById.mockRejectedValue(
      Object.assign(new Error('Estabelecimento não encontrado'), { status: 404 })
    );
  });

  it('POST /sincronizar triggers refs-only sync and returns counts', async () => {
    const res = await request(app)
      .post('/api/cadastros/sincronizar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');
    expect(res.body.estabelecimentos.inserted).toBe(0);
    expect(res.body.formas).toEqual({ inserted: 3, updated: 4, inactivated: 0 });
    expect(res.body.cbos).toEqual({ inserted: 5, updated: 6, inactivated: 0 });
    expect(res.body.rubricas).toEqual({ inserted: 7, updated: 8, inactivated: 0 });
    expect(sincronizarReferencias).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'cadastros_sincronizar_referencias',
        recurso: 'cadastros',
      })
    );
  });

  it('POST /sincronizar skips audit on erro status', async () => {
    sincronizarReferencias.mockResolvedValueOnce({
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
    sincronizarReferencias.mockRejectedValueOnce(err);

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
    expect(res.body.data[0].formas).toEqual({
      inserted: 3,
      updated: 4,
      inactivated: 0,
    });
    expect(res.body.data[0].cbos).toEqual({
      inserted: 5,
      updated: 6,
      inactivated: 0,
    });
    expect(res.body.data[0].rubricas).toEqual({
      inserted: 7,
      updated: 8,
      inactivated: 0,
    });
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
    expect(res.body.formas).toEqual({
      inserted: 3,
      updated: 4,
      inactivated: 0,
    });
    expect(res.body.cbos).toEqual({
      inserted: 5,
      updated: 6,
      inactivated: 0,
    });
    expect(res.body.rubricas).toEqual({
      inserted: 7,
      updated: 8,
      inactivated: 0,
    });
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

  it('POST /sincronizar (refs-only) returns zeroed estab/proc counts and forma/cbo/rubrica counts', async () => {
    // The route now calls sincronizarReferencias (refs-only): estab+proc are NOT synced.
    // The mock returns zeroed estab/proc counts and real forma/cbo/rubrica counts,
    // matching the Python --refs-only behavior.
    const syncRes = await request(app)
      .post('/api/cadastros/sincronizar')
      .set('Authorization', authHeader());

    expect(syncRes.status).toBe(201);
    expect(syncRes.body.status).toBe('ok');
    expect(syncRes.body.estabelecimentos).toEqual({ inserted: 0, updated: 0, inactivated: 0 });
    expect(syncRes.body.procedimentos).toEqual({ inserted: 0, updated: 0, inactivated: 0 });
    expect(syncRes.body.formas).toEqual({ inserted: 3, updated: 4, inactivated: 0 });
    expect(syncRes.body.cbos).toEqual({ inserted: 5, updated: 6, inactivated: 0 });
    expect(sincronizarReferencias).toHaveBeenCalledTimes(1);
  });

  it('POST /sincronizar returns 403 for non-planning profile', async () => {
    const res = await request(app)
      .post('/api/cadastros/sincronizar')
      .set('Authorization', unidadeHeader());

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permissão/i);
    expect(sincronizarReferencias).not.toHaveBeenCalled();
  });

  it('requires JWT', async () => {
    const res = await request(app).post('/api/cadastros/sincronizar');
    expect(res.status).toBe(401);
  });

  it('POST /sync-plano returns 403 for non-planning profile', async () => {
    const res = await request(app)
      .post('/api/cadastros/sync-plano')
      .set('Authorization', unidadeHeader());

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permissão/i);
    expect(planejarSync).not.toHaveBeenCalled();
  });

  it('POST /sync-plano/aplicar returns 400 when itens is empty', async () => {
    const res = await request(app)
      .post('/api/cadastros/sync-plano/aplicar')
      .set('Authorization', authHeader())
      .send({ itens: [] });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/nenhum item/i);
    expect(aplicarPlano).not.toHaveBeenCalled();
  });

  it('POST /sync-plano/aplicar returns 400 when itens is missing', async () => {
    const res = await request(app)
      .post('/api/cadastros/sync-plano/aplicar')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/nenhum item/i);
    expect(aplicarPlano).not.toHaveBeenCalled();
  });

  it('POST /sync-plano/aplicar returns 403 for non-planning profile', async () => {
    const res = await request(app)
      .post('/api/cadastros/sync-plano/aplicar')
      .set('Authorization', unidadeHeader())
      .send({ itens: [{ entidade: 'estabelecimento', chave: '111', tipo: 'sumiu', diff: {} }] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/permissão/i);
    expect(aplicarPlano).not.toHaveBeenCalled();
  });
});
