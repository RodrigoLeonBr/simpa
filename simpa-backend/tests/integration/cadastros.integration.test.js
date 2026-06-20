const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../../src/services/db');
const { authHeader } = require('../helpers/auth');
const app = require('../../src/app');

const hasPg =
  process.env.PG_HOST &&
  process.env.PG_DB &&
  process.env.PG_USER &&
  process.env.PG_PASS;

const describeIfPg = hasPg ? describe : describe.skip;

let pgReady = false;
let unidadeId = null;

function itIfPg(name, fn) {
  it(name, async () => {
    if (!pgReady) return;
    await fn();
  });
}

function gestorHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    {
      sub: 99,
      username: 'gestor-int',
      nome: 'Gestor Int',
      perfil: 'Gestor Secretaria',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

describeIfPg('cadastros integration', () => {
  beforeAll(async () => {
    try {
      await query('SELECT 1');
      await query("DELETE FROM unidades_saude WHERE codigo = 'INT-UBS-08'");
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  afterAll(async () => {
    if (!pgReady || !unidadeId) return;
    await query('DELETE FROM unidades_saude WHERE id = $1', [unidadeId]);
  });

  itIfPg('CRUD round-trip for unidades_saude', async () => {
    const create = await request(app)
      .post('/api/cadastros/unidades')
      .set('Authorization', authHeader())
      .send({
        codigo: 'INT-UBS-08',
        nome: 'UBS Integração Task 08',
        tipo: 'APS',
        cnes: '7654321',
      });

    expect(create.status).toBe(201);
    expect(create.body.codigo).toBe('INT-UBS-08');
    unidadeId = create.body.id;

    const update = await request(app)
      .put(`/api/cadastros/unidades/${unidadeId}`)
      .set('Authorization', authHeader())
      .send({ nome: 'UBS Integração Atualizada', tipo: 'APS', cnes: '7654321' });

    expect(update.status).toBe(200);
    expect(update.body.nome).toBe('UBS Integração Atualizada');

    const list = await request(app)
      .get('/api/cadastros/unidades')
      .set('Authorization', authHeader());

    expect(list.status).toBe(200);
    expect(list.body.some((row) => row.id === unidadeId)).toBe(true);

    const inactivate = await request(app)
      .delete(`/api/cadastros/unidades/${unidadeId}`)
      .set('Authorization', authHeader());

    expect(inactivate.status).toBe(200);
    expect(inactivate.body.inativado).toBe(true);

    const { rows } = await query(
      'SELECT status FROM unidades_saude WHERE id = $1',
      [unidadeId]
    );
    expect(rows[0].status).toBe('inativo');
  });
});

describeIfPg('admin integration', () => {
  beforeAll(async () => {
    try {
      await query('SELECT 1');
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  itIfPg('non-admin cannot DELETE usuarios', async () => {
    const res = await request(app)
      .delete('/api/admin/usuarios/1')
      .set('Authorization', gestorHeader());

    expect(res.status).toBe(403);
  });
});
