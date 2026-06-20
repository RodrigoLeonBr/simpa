jest.mock('../src/services/db');
jest.mock('../src/services/authService', () => ({
  ...jest.requireActual('../src/services/authService'),
  authenticate: jest.fn(),
}));
jest.mock('../src/services/auditService');

const request = require('supertest');
const { authenticate, INVALID_CREDENTIALS } = require('../src/services/authService');
const { logAudit } = require('../src/services/auditService');
const app = require('../src/app');

describe('auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logAudit.mockResolvedValue(undefined);
  });

  it('login returns generic error for bad credentials', async () => {
    authenticate.mockResolvedValueOnce({ ok: false, user: null });

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', senha: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe(INVALID_CREDENTIALS);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'login_failed' })
    );
  });

  it('login returns token and user on success', async () => {
    authenticate.mockResolvedValueOnce({
      ok: true,
      token: 'jwt-token',
      user: { username: 'admin', nome: 'Admin', perfil: 'Administrador' },
      userId: 1,
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', senha: 'simpa@2026' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe('jwt-token');
    expect(res.body.user.perfil).toBe('Administrador');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'login_success', usuarioId: 1 })
    );
  });

  it('logout returns ok', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('login validates required body fields', async () => {
    const res = await request(app).post('/auth/login').send({ username: 'admin' });
    expect(res.status).toBe(400);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('GET /auth/me requires valid JWT', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /auth/me returns user from token', async () => {
    const jwt = require('jsonwebtoken');
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    const token = jwt.sign(
      { sub: 1, username: 'admin', nome: 'Admin SIMPA', perfil: 'Administrador' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      username: 'admin',
      nome: 'Admin SIMPA',
      perfil: 'Administrador',
    });
  });

  it('login forwards unexpected errors to error handler', async () => {
    authenticate.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', senha: 'simpa@2026' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('db down');
  });
});

describe('protected API routes', () => {
  it('returns 401 without token on dashboard route', async () => {
    const res = await request(app).get('/api/v1/dashboard/planejamento');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/token/i);
  });

  it('returns 400 without competencia when authenticated', async () => {
    const jwt = require('jsonwebtoken');
    process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
    const token = jwt.sign(
      { sub: 1, username: 'admin', nome: 'Admin', perfil: 'Administrador' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/v1/dashboard/planejamento')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/competencia/i);
  });
});
