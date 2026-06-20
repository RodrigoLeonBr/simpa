jest.mock('../src/services/db');
jest.mock('../src/services/cadastrosService', () => {
  const actual = jest.requireActual('../src/services/cadastrosService');
  return {
    ...actual,
    listEntity: jest.fn(),
    createEntity: jest.fn(),
    updateEntity: jest.fn(),
    inactivateEntity: jest.fn(),
  };
});

const request = require('supertest');
const {
  listEntity,
  createEntity,
  updateEntity,
  inactivateEntity,
} = require('../src/services/cadastrosService');
const { authHeader } = require('./helpers/auth');
const app = require('../src/app');

describe('cadastros routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listEntity.mockResolvedValue([]);
    createEntity.mockResolvedValue({ id: 1, codigo: 'U01', nome: 'UBS' });
    updateEntity.mockResolvedValue({ id: 1, nome: 'UBS Atualizada' });
    inactivateEntity.mockResolvedValue({ inativado: true, id: 1 });
  });

  it('GET /unidades lists active records', async () => {
    listEntity.mockResolvedValueOnce([{ id: 1, nome: 'UBS' }]);

    const res = await request(app)
      .get('/api/cadastros/unidades')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(listEntity).toHaveBeenCalledWith('unidades', {});
  });

  it('POST /unidades creates record', async () => {
    const res = await request(app)
      .post('/api/cadastros/unidades')
      .set('Authorization', authHeader())
      .send({ codigo: 'U01', nome: 'UBS Centro', cnes: '1234567' });

    expect(res.status).toBe(201);
    expect(createEntity).toHaveBeenCalledWith('unidades', expect.any(Object));
  });

  it('DELETE /unidades soft inactivates', async () => {
    const res = await request(app)
      .delete('/api/cadastros/unidades/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.inativado).toBe(true);
    expect(inactivateEntity).toHaveBeenCalledWith('unidades', '1');
  });

  it('GET /procedimentos is available', async () => {
    const res = await request(app)
      .get('/api/cadastros/procedimentos')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(listEntity).toHaveBeenCalledWith('procedimentos', {});
  });

  it('PUT /unidades updates record', async () => {
    const res = await request(app)
      .put('/api/cadastros/unidades/1')
      .set('Authorization', authHeader())
      .send({ nome: 'UBS Atualizada', tipo: 'APS' });

    expect(res.status).toBe(200);
    expect(updateEntity).toHaveBeenCalledWith('unidades', '1', expect.any(Object));
  });

  it('propagates service errors', async () => {
    const err = new Error('db down');
    err.status = 500;
    listEntity.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/hospitais')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  it('propagates POST validation errors', async () => {
    const err = new Error('codigo é obrigatório');
    err.status = 400;
    createEntity.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/cadastros/emendas')
      .set('Authorization', authHeader())
      .send({ esfera: 'federal' });

    expect(res.status).toBe(400);
  });

  it('propagates DELETE not found', async () => {
    const err = new Error('Emenda não encontrada');
    err.status = 404;
    inactivateEntity.mockRejectedValueOnce(err);

    const res = await request(app)
      .delete('/api/cadastros/emendas/404')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('requires JWT', async () => {
    const res = await request(app).get('/api/cadastros/unidades');
    expect(res.status).toBe(401);
  });
});
