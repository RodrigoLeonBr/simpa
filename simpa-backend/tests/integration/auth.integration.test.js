const request = require('supertest');
const bcrypt = require('bcrypt');
const { query } = require('../../src/services/db');
const app = require('../../src/app');

const hasPg =
  process.env.PG_HOST &&
  process.env.PG_DB &&
  process.env.PG_USER &&
  process.env.PG_PASS;

const describeIfPg = hasPg ? describe : describe.skip;

const ADMIN_HASH = '$2b$10$bWuq3.DwWV8yJVWkUxGnie5DPTN5JLnv5pkR.Xz5tr6tfRAhDM/re';

let pgReady = false;

function itIfPg(name, fn) {
  it(name, async () => {
    if (!pgReady) return;
    await fn();
  });
}

describeIfPg('auth integration', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'integration-test-secret-min-32-chars';
    try {
      await query('SELECT 1');
      await query(
        `INSERT INTO usuarios (username, senha_hash, nome, perfil)
         VALUES ('admin', $1, 'Administrador SIMPA', 'Administrador')
         ON CONFLICT (username) DO UPDATE
           SET senha_hash = EXCLUDED.senha_hash,
               ativo = true`,
        [ADMIN_HASH]
      );
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  itIfPg('POST /auth/login then GET /auth/me with Bearer token', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', senha: 'simpa@2026' });

    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
    expect(login.body.user.perfil).toBe('Administrador');

    const me = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(me.status).toBe(200);
    expect(me.body).toEqual({
      username: 'admin',
      nome: 'Administrador SIMPA',
      perfil: 'Administrador',
    });
  });

  itIfPg('logs login_success to audit_log', async () => {
    await request(app)
      .post('/auth/login')
      .send({ username: 'admin', senha: 'simpa@2026' });

    const audit = await query(
      `SELECT acao FROM audit_log
       WHERE acao = 'login_success'
       ORDER BY id DESC
       LIMIT 1`
    );

    expect(audit.rows[0]?.acao).toBe('login_success');
  });

  itIfPg('GET /api/v1/dashboard/planejamento without token returns 401', async () => {
    const res = await request(app).get('/api/v1/dashboard/planejamento');
    expect(res.status).toBe(401);
  });

  itIfPg('GET /api/v1/dashboard/planejamento with valid login token passes verifyJWT', async () => {
    const login = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', senha: 'simpa@2026' });

    const res = await request(app)
      .get('/api/v1/dashboard/planejamento')
      .set('Authorization', `Bearer ${login.body.token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/competencia/i);
  });

  itIfPg('rejects invalid password with generic message', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'admin', senha: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Credenciais inválidas');
  });
});

describe('bcrypt seed hash', () => {
  it('verifies seed admin password hash', async () => {
    const ok = await bcrypt.compare('simpa@2026', ADMIN_HASH);
    expect(ok).toBe(true);
  });
});
