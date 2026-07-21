jest.mock('../src/services/db');
jest.mock('../src/services/leitosVigenciaService');
jest.mock('../src/services/auditService');

const request = require('supertest');
const {
  listLeitosVigencias,
  createLeitosVigencia,
  updateLeitosVigencia,
  deleteLeitosVigencia,
} = require('../src/services/leitosVigenciaService');
const { logAudit } = require('../src/services/auditService');
const { authHeader, unidadeHeader } = require('./helpers/auth');
const app = require('../src/app');

describe('leitos-vigencias routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logAudit.mockResolvedValue(undefined);
    listLeitosVigencias.mockResolvedValue([
      {
        id: 5,
        estabelecimento_id: 1,
        vigencia_inicio: '202601',
        vigencia_fim: '999999',
        leitos: { clinico: 10 },
        leitos_detalhe: {},
      },
    ]);
    createLeitosVigencia.mockResolvedValue({
      id: 5,
      estabelecimento_id: 1,
      vigencia_inicio: '202601',
      vigencia_fim: '999999',
      leitos: { clinico: 10 },
    });
    updateLeitosVigencia.mockResolvedValue({
      id: 5,
      estabelecimento_id: 1,
      vigencia_inicio: '202601',
      vigencia_fim: '999999',
      leitos: { clinico: 12 },
    });
    deleteLeitosVigencia.mockResolvedValue({ ok: true });
  });

  it('GET /estabelecimentos/:id/leitos-vigencias returns 200 with array', async () => {
    const res = await request(app)
      .get('/api/cadastros/estabelecimentos/1/leitos-vigencias')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
    expect(listLeitosVigencias).toHaveBeenCalledWith('1');
  });

  it('POST /estabelecimentos/:id/leitos-vigencias returns 201 for planning staff', async () => {
    const body = { vigencia_inicio: '202601', vigencia_fim: '999999', leitos: { clinico: 10 } };

    const res = await request(app)
      .post('/api/cadastros/estabelecimentos/1/leitos-vigencias')
      .set('Authorization', authHeader())
      .send(body);

    expect(res.status).toBe(201);
    expect(createLeitosVigencia).toHaveBeenCalledWith('1', body);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'estabelecimento_leitos_vigencia_update',
        recurso: 'estabelecimentos',
      })
    );
  });

  it('POST /estabelecimentos/:id/leitos-vigencias returns 403 for read-only user', async () => {
    const res = await request(app)
      .post('/api/cadastros/estabelecimentos/1/leitos-vigencias')
      .set('Authorization', unidadeHeader())
      .send({ vigencia_inicio: '202601', vigencia_fim: '999999', leitos: { clinico: 10 } });

    expect(res.status).toBe(403);
    expect(createLeitosVigencia).not.toHaveBeenCalled();
  });

  it('POST /estabelecimentos/:id/leitos-vigencias returns 400 when service rejects with overlap', async () => {
    const err = new Error('Vigência sobrepõe período existente');
    err.status = 400;
    createLeitosVigencia.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/cadastros/estabelecimentos/1/leitos-vigencias')
      .set('Authorization', authHeader())
      .send({ vigencia_inicio: '202601', vigencia_fim: '999999', leitos: { clinico: 10 } });

    expect(res.status).toBe(400);
  });

  it('PUT /estabelecimentos/:id/leitos-vigencias/:vigenciaId returns 200 for planning staff', async () => {
    const body = { vigencia_inicio: '202601', vigencia_fim: '999999', leitos: { clinico: 12 } };

    const res = await request(app)
      .put('/api/cadastros/estabelecimentos/1/leitos-vigencias/5')
      .set('Authorization', authHeader())
      .send(body);

    expect(res.status).toBe(200);
    expect(updateLeitosVigencia).toHaveBeenCalledWith('1', '5', body);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'estabelecimento_leitos_vigencia_update',
        recurso: 'estabelecimentos',
      })
    );
  });

  it('DELETE /estabelecimentos/:id/leitos-vigencias/:vigenciaId returns 200 for planning staff', async () => {
    const res = await request(app)
      .delete('/api/cadastros/estabelecimentos/1/leitos-vigencias/5')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(deleteLeitosVigencia).toHaveBeenCalledWith('1', '5');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'estabelecimento_leitos_vigencia_update',
        recurso: 'estabelecimentos',
      })
    );
  });

  it('DELETE /estabelecimentos/:id/leitos-vigencias/:vigenciaId returns 404 when service rejects', async () => {
    const err = new Error('Vigência não encontrada');
    err.status = 404;
    deleteLeitosVigencia.mockRejectedValueOnce(err);

    const res = await request(app)
      .delete('/api/cadastros/estabelecimentos/1/leitos-vigencias/5')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('requires JWT', async () => {
    const res = await request(app).get('/api/cadastros/estabelecimentos/1/leitos-vigencias');
    expect(res.status).toBe(401);
  });
});
