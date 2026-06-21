jest.mock('../src/services/painelWidgetsService', () => ({
  resolvePainelLayout: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { resolvePainelLayout } = require('../src/services/painelWidgetsService');
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

describe('painel-layout route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET sem competencia retorna 400', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/painel-layout')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/competencia inválida/i);
    expect(resolvePainelLayout).not.toHaveBeenCalled();
  });

  it('GET com params válidos retorna 200', async () => {
    resolvePainelLayout.mockResolvedValueOnce({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
      widgets: [],
    });

    const res = await request(app)
      .get('/api/v1/dashboard/painel-layout')
      .query({ competencia: '2026-05' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
      widgets: [],
    });
    expect(resolvePainelLayout).toHaveBeenCalledWith({
      competencia: '2026-05',
      perfil: 'APS',
      layout: 'A',
      estabelecimentoId: null,
      equipeId: null,
    });
  });

  it('invalid estabelecimento_id retorna 400', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/painel-layout')
      .query({
        competencia: '2026-05',
        estabelecimento_id: 'abc',
      })
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/estabelecimento_id inválido/i);
    expect(resolvePainelLayout).not.toHaveBeenCalled();
  });

  it('erro de serviço 404 propaga status', async () => {
    const err = new Error('Nenhum widget ativo para perfil/layout informado');
    err.status = 404;
    err.code = 'WIDGETS_NOT_FOUND';
    resolvePainelLayout.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/v1/dashboard/painel-layout')
      .query({ competencia: '2026-05' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('WIDGETS_NOT_FOUND');
  });
});
