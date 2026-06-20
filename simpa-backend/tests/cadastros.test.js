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

describe('cadastros manual CRUD routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listEntity.mockResolvedValue([]);
    createEntity.mockResolvedValue({ id: 1, codigo: 'EQ01', nome: 'Equipe 1' });
    updateEntity.mockResolvedValue({ id: 1, nome: 'Equipe Atualizada' });
    inactivateEntity.mockResolvedValue({ inativado: true, id: 1 });
  });

  it('GET /equipes lists active records', async () => {
    listEntity.mockResolvedValueOnce([{ id: 1, nome: 'Equipe 1' }]);

    const res = await request(app)
      .get('/api/cadastros/equipes')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(listEntity).toHaveBeenCalledWith('equipes', {});
  });

  it('POST /equipes creates record', async () => {
    const res = await request(app)
      .post('/api/cadastros/equipes')
      .set('Authorization', authHeader())
      .send({ codigo: 'EQ01', nome: 'Equipe 1' });

    expect(res.status).toBe(201);
    expect(createEntity).toHaveBeenCalledWith('equipes', expect.any(Object));
  });

  it('DELETE /equipes soft inactivates', async () => {
    const res = await request(app)
      .delete('/api/cadastros/equipes/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.inativado).toBe(true);
    expect(inactivateEntity).toHaveBeenCalledWith('equipes', '1');
  });

  it('propagates service errors for emendas', async () => {
    const err = new Error('db down');
    err.status = 500;
    listEntity.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/emendas')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  it('propagates POST validation errors', async () => {
    const err = new Error('id_emenda é obrigatório');
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

  it('propagates PUT update errors', async () => {
    const err = new Error('Equipe não encontrada');
    err.status = 404;
    updateEntity.mockRejectedValueOnce(err);

    const res = await request(app)
      .put('/api/cadastros/equipes/404')
      .set('Authorization', authHeader())
      .send({ nome: 'Nova' });

    expect(res.status).toBe(404);
  });

  it('requires JWT', async () => {
    const res = await request(app).get('/api/cadastros/equipes');
    expect(res.status).toBe(401);
  });

  it.each([
    ['GET', '/api/cadastros/unidades'],
    ['POST', '/api/cadastros/unidades'],
    ['GET', '/api/cadastros/prestadores-mac'],
    ['POST', '/api/cadastros/prestadores-mac'],
    ['GET', '/api/cadastros/hospitais'],
    ['POST', '/api/cadastros/hospitais'],
  ])('%s %s returns 404 for removed legacy entity', async (method, path) => {
    const res = await request(app)[method.toLowerCase()](path)
      .set('Authorization', authHeader())
      .send({ codigo: 'X', nome: 'Y' });

    expect(res.status).toBe(404);
  });
});
