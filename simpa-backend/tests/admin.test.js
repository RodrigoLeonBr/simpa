jest.mock('../src/services/db');
jest.mock('../src/services/auditService', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

const jwt = require('jsonwebtoken');
const request = require('supertest');
const bcrypt = require('bcrypt');
const { query } = require('../src/services/db');
const { authHeader } = require('./helpers/auth');
const app = require('../src/app');

function gestorHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    {
      sub: 2,
      username: 'gestor',
      nome: 'Gestor',
      perfil: 'Gestor Secretaria',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

function planejamentoHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    {
      sub: 5,
      username: 'plan',
      nome: 'Planejamento',
      perfil: 'Planejamento',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

describe('admin routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it('blocks non-admin from usuarios list', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', gestorHeader());

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('blocks non-admin from DELETE usuarios', async () => {
    const res = await request(app)
      .delete('/api/admin/usuarios/2')
      .set('Authorization', gestorHeader());

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('admin can list usuarios', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'admin', perfil: 'Administrador', ativo: true }],
    });

    const res = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('admin can create usuario with bcrypt hash', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 3, username: 'novo', nome: 'Novo', perfil: 'Planejamento', ativo: true }],
    });

    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', authHeader())
      .send({
        username: 'novo',
        senha: 'senha-forte-123',
        nome: 'Novo Usuário',
        perfil: 'Planejamento',
      });

    expect(res.status).toBe(201);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO usuarios'),
      expect.arrayContaining(['novo', expect.any(String), 'Novo Usuário', 'Planejamento'])
    );

    const hash = query.mock.calls[0][1][1];
    await expect(bcrypt.compare('senha-forte-123', hash)).resolves.toBe(true);
  });

  it('GET /audit-log returns paginated data', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 1, acao: 'login_success', username: 'admin' }],
      });

    const res = await request(app)
      .get('/api/admin/audit-log?page=1&limit=10')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });

  it('Planejamento can read audit-log', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/audit-log')
      .set('Authorization', planejamentoHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('Planejamento cannot list usuarios', async () => {
    const res = await request(app)
      .get('/api/admin/usuarios')
      .set('Authorization', planejamentoHeader());

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('PUT /configuracoes upserts settings', async () => {
    query.mockResolvedValueOnce({
      rows: [{ chave: 'competencia_ativa_padrao', valor: '2026-05' }],
    });

    const res = await request(app)
      .put('/api/admin/configuracoes')
      .set('Authorization', authHeader())
      .send({
        chave: 'competencia_ativa_padrao',
        valor: '2026-05',
      });

    expect(res.status).toBe(200);
    expect(res.body[0].chave).toBe('competencia_ativa_padrao');
  });

  it('PUT /usuarios/:id updates user and resets password', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 2, username: 'user2', nome: 'Atualizado', perfil: 'Planejamento', ativo: true }],
    });

    const res = await request(app)
      .put('/api/admin/usuarios/2')
      .set('Authorization', authHeader())
      .send({ nome: 'Atualizado', senha: 'nova-senha-123' });

    expect(res.status).toBe(200);
    expect(res.body.nome).toBe('Atualizado');
  });

  it('DELETE /usuarios/:id inactivates user', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 4 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 4, username: 'old', ativo: false }],
      });

    const res = await request(app)
      .delete('/api/admin/usuarios/4')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.inativado).toBe(true);
  });

  it('validates usuario create payload', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', authHeader())
      .send({ username: 'x' });

    expect(res.status).toBe(400);
  });

  it('GET /audit-log accepts filters', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/admin/audit-log?usuario_id=1&acao=login_success')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('GET /configuracoes lists settings', async () => {
    query.mockResolvedValueOnce({
      rows: [{ chave: 'competencia_ativa_padrao', valor: '2026-05' }],
    });

    const res = await request(app)
      .get('/api/admin/configuracoes')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body[0].chave).toBe('competencia_ativa_padrao');
  });

  it('PUT /configuracoes accepts batch payload', async () => {
    query.mockResolvedValueOnce({
      rows: [{ chave: 'municipio_padrao', valor: 'AMERICANA' }],
    });

    const res = await request(app)
      .put('/api/admin/configuracoes')
      .set('Authorization', authHeader())
      .send({
        configuracoes: [{ chave: 'municipio_padrao', valor: 'AMERICANA' }],
      });

    expect(res.status).toBe(200);
  });

  it('rejects invalid configuracoes payload', async () => {
    const res = await request(app)
      .put('/api/admin/configuracoes')
      .set('Authorization', authHeader())
      .send({});

    expect(res.status).toBe(400);
  });

  it('PUT /usuarios/:id validates perfil and empty body', async () => {
    const invalidPerfil = await request(app)
      .put('/api/admin/usuarios/2')
      .set('Authorization', authHeader())
      .send({ perfil: 'Invalido' });

    expect(invalidPerfil.status).toBe(400);

    const empty = await request(app)
      .put('/api/admin/usuarios/2')
      .set('Authorization', authHeader())
      .send({});

    expect(empty.status).toBe(400);
  });

  it('returns 404 for missing usuario on update/delete', async () => {
    query.mockResolvedValue({ rows: [] });

    const update = await request(app)
      .put('/api/admin/usuarios/999')
      .set('Authorization', authHeader())
      .send({ nome: 'X' });

    expect(update.status).toBe(404);

    const del = await request(app)
      .delete('/api/admin/usuarios/999')
      .set('Authorization', authHeader());

    expect(del.status).toBe(404);
  });

  it('rejects duplicate username on create', async () => {
    const err = new Error('duplicate');
    err.code = '23505';
    query.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', authHeader())
      .send({
        username: 'admin',
        senha: 'senha-forte-123',
        nome: 'Dup',
        perfil: 'Planejamento',
      });

    expect(res.status).toBe(409);
  });

  it('rejects invalid perfil on create', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', authHeader())
      .send({
        username: 'x',
        senha: 'senha-forte-123',
        nome: 'X',
        perfil: 'Invalido',
      });

    expect(res.status).toBe(400);
  });

  it('rejects short password on create', async () => {
    const res = await request(app)
      .post('/api/admin/usuarios')
      .set('Authorization', authHeader())
      .send({
        username: 'novo',
        senha: '123',
        nome: 'Novo',
        perfil: 'Planejamento',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 caracteres/);
  });

  it('blocks admin from inactivating own account', async () => {
    const res = await request(app)
      .delete('/api/admin/usuarios/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(403);
    expect(query).not.toHaveBeenCalled();
  });
});
