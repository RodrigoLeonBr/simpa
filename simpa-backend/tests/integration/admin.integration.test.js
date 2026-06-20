const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../../src/services/db');
const app = require('../../src/app');

const hasPg =
  process.env.PG_HOST &&
  process.env.PG_DB &&
  process.env.PG_USER &&
  process.env.PG_PASS;

const describeIfPg = hasPg ? describe : describe.skip;

function gestorHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    {
      sub: 99,
      username: 'gestor-admin-int',
      nome: 'Gestor Admin Int',
      perfil: 'Gestor de Unidade',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

describeIfPg('admin integration access control', () => {
  it('non-admin cannot DELETE usuarios', async () => {
    try {
      await query('SELECT 1');
    } catch (_err) {
      return;
    }

    const res = await request(app)
      .delete('/api/admin/usuarios/1')
      .set('Authorization', gestorHeader());

    expect(res.status).toBe(403);
  });
});
