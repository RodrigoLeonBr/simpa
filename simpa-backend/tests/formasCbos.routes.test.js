jest.mock('../src/services/db');
jest.mock('../src/services/formasService');
jest.mock('../src/services/cbosService');

const request = require('supertest');
const { listFormas } = require('../src/services/formasService');
const { listCbos } = require('../src/services/cbosService');
const { authHeader } = require('./helpers/auth');
const app = require('../src/app');

describe('formas and cbos routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listFormas.mockResolvedValue({
      data: [
        {
          id: 1,
          codigo_grupo: '03',
          codigo_subgrupo: '0301',
          codigo_forma: '030101',
          descricao: 'CONSULTA MEDICA',
          status: 'ativo',
          sincronizado_em: '2026-06-20T12:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    });
    listCbos.mockResolvedValue({
      data: [
        {
          id: 1,
          codigo_cbo: '225125',
          descricao: 'MEDICO CLINICO',
          status: 'ativo',
          sincronizado_em: '2026-06-20T12:00:00Z',
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    });
  });

  it('GET /formas returns paginated list', async () => {
    const res = await request(app)
      .get('/api/cadastros/formas')
      .query({ q: 'CONSULTA' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].codigo_forma).toBe('030101');
    expect(listFormas).toHaveBeenCalledWith(expect.objectContaining({ q: 'CONSULTA' }));
  });

  it('GET /formas passes grupo and subgrupo filters to service', async () => {
    const res = await request(app)
      .get('/api/cadastros/formas')
      .query({ grupo: '03', subgrupo: '0301' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(listFormas).toHaveBeenCalledWith(
      expect.objectContaining({ grupo: '03', subgrupo: '0301' })
    );
  });

  it('GET /cbos returns paginated list', async () => {
    const res = await request(app)
      .get('/api/cadastros/cbos')
      .query({ q: 'MEDICO' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].codigo_cbo).toBe('225125');
    expect(listCbos).toHaveBeenCalledWith(expect.objectContaining({ q: 'MEDICO' }));
  });

  it('GET /formas propagates service errors', async () => {
    const err = new Error('grupo inválido');
    err.status = 400;
    listFormas.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/formas')
      .query({ grupo: '030' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  it('POST /formas returns 405', async () => {
    const res = await request(app)
      .post('/api/cadastros/formas')
      .set('Authorization', authHeader())
      .send({ codigo_forma: '030101' });

    expect(res.status).toBe(405);
    expect(res.body.error).toMatch(/somente leitura/i);
    expect(res.body.allow).toBe('GET');
    expect(listFormas).not.toHaveBeenCalled();
  });

  it('PUT /formas/:id returns 405', async () => {
    const res = await request(app)
      .put('/api/cadastros/formas/1')
      .set('Authorization', authHeader())
      .send({ descricao: 'X' });

    expect(res.status).toBe(405);
    expect(listFormas).not.toHaveBeenCalled();
  });

  it('DELETE /formas/:id returns 405', async () => {
    const res = await request(app)
      .delete('/api/cadastros/formas/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(405);
    expect(listFormas).not.toHaveBeenCalled();
  });

  it('POST /cbos returns 405', async () => {
    const res = await request(app)
      .post('/api/cadastros/cbos')
      .set('Authorization', authHeader())
      .send({ codigo_cbo: '225125' });

    expect(res.status).toBe(405);
    expect(res.body.error).toMatch(/somente leitura/i);
    expect(res.body.allow).toBe('GET');
    expect(listCbos).not.toHaveBeenCalled();
  });

  it('PUT /cbos/:id returns 405', async () => {
    const res = await request(app)
      .put('/api/cadastros/cbos/1')
      .set('Authorization', authHeader())
      .send({ descricao: 'X' });

    expect(res.status).toBe(405);
    expect(listCbos).not.toHaveBeenCalled();
  });

  it('DELETE /cbos/:id returns 405', async () => {
    const res = await request(app)
      .delete('/api/cadastros/cbos/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(405);
    expect(listCbos).not.toHaveBeenCalled();
  });

  it('requires JWT for formas', async () => {
    const res = await request(app).get('/api/cadastros/formas');
    expect(res.status).toBe(401);
    expect(listFormas).not.toHaveBeenCalled();
  });

  it('requires JWT for cbos', async () => {
    const res = await request(app).get('/api/cadastros/cbos');
    expect(res.status).toBe(401);
    expect(listCbos).not.toHaveBeenCalled();
  });
});
