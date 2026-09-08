'use strict';

jest.mock('../src/services/db');
jest.mock('../src/services/vacinaImportService');
jest.mock('../src/services/vacinaService');
jest.mock('../src/services/vacinaCadastroService');
jest.mock('../src/services/auditService');
// removeTempFile must be a no-op so we don't touch the fs
jest.mock('../src/services/storage', () => ({ removeTempFile: jest.fn() }));

const request = require('supertest');
const { query } = require('../src/services/db');
const { parseUpload, gravarCarga, analisarPreview } = require('../src/services/vacinaImportService');
const { getCobertura } = require('../src/services/vacinaService');
const {
  listGrupos,
  createGrupo,
  updateGrupo,
  listFaixaGrupo,
  setFaixaGrupo,
  listPopulacao,
  upsertPopulacao,
  listEsquema,
  upsertEsquema,
  deleteEsquema,
  listImunobiologicos,
} = require('../src/services/vacinaCadastroService');
const { authHeader, unidadeHeader } = require('./helpers/auth');
const app = require('../src/app');

// ── default resolved values ───────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  query.mockResolvedValue({ rows: [] });

  getCobertura.mockResolvedValue([
    { imuno_codigo: '93', imuno_nome: 'HPV', grupo_id: 1, grupo_nome: 'Adolescente', doses: 200, pop_alvo: 100, num_doses: 2, denominador: 200, cobertura_pct: 100 },
  ]);

  listImunobiologicos.mockResolvedValue([{ imuno_codigo: '93', imuno_nome: 'HPV' }]);
  listGrupos.mockResolvedValue([{ id: 1, nome: 'Adolescente', slug: 'adolescente', ordem: 1, ativo: true }]);
  createGrupo.mockResolvedValue({ id: 2, nome: 'Criança', slug: 'crianca', ordem: 2, ativo: true });
  updateGrupo.mockResolvedValue({ id: 1, nome: 'Adolescente', slug: 'adolescente', ordem: 1, ativo: true });
  listFaixaGrupo.mockResolvedValue([{ faixa_nies: '05 a 11 anos', grupo_id: 1, grupo_nome: 'Adolescente' }]);
  setFaixaGrupo.mockResolvedValue({ faixa_nies: '05 a 11 anos', grupo_id: 1 });
  listPopulacao.mockResolvedValue([{ id: 1, ano: 2026, grupo_id: 1, grupo_nome: 'Adolescente', populacao: 500 }]);
  upsertPopulacao.mockResolvedValue({ id: 1, ano: 2026, grupo_id: 1, populacao: 500 });
  listEsquema.mockResolvedValue([{ id: 1, imuno_codigo: '93', imuno_nome: 'HPV', grupo_id: 1, grupo_nome: 'Adolescente', num_doses: 2 }]);
  upsertEsquema.mockResolvedValue({ id: 1, imuno_codigo: '93', grupo_id: 1, num_doses: 2 });
  deleteEsquema.mockResolvedValue({ id: 1 });

  parseUpload.mockResolvedValue({
    competencia: '2026-01-01',
    doses_total: 3,
    arquivo_nome: 'vacina_jan_2026.xlsx',
    linhas: [],
  });
  analisarPreview.mockResolvedValue({
    competencia: '2026-01-01',
    doses_total: 3,
    linhas: 0,
    faixas_nao_mapeadas: [],
  });
  gravarCarga.mockResolvedValue({ carga_id: 1, competencia: '2026-01-01', doses_total: 3, linhas: 0 });
});

// ── GET /cobertura ────────────────────────────────────────────────────────────

describe('GET /api/vacina/cobertura', () => {
  it('400 when ano missing', async () => {
    const res = await request(app).get('/api/vacina/cobertura').set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ano/i);
    expect(getCobertura).not.toHaveBeenCalled();
  });

  it('400 when ano is not a number (NaN)', async () => {
    const res = await request(app).get('/api/vacina/cobertura?ano=abc').set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('400 when ano < 2000', async () => {
    const res = await request(app).get('/api/vacina/cobertura?ano=1999').set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('400 when ano > 2100', async () => {
    const res = await request(app).get('/api/vacina/cobertura?ano=2101').set('Authorization', authHeader());
    expect(res.status).toBe(400);
  });

  it('200 with valid ano (uses default competenciaAte)', async () => {
    const res = await request(app).get('/api/vacina/cobertura?ano=2026').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(getCobertura).toHaveBeenCalledWith(expect.objectContaining({
      ano: 2026,
      competenciaAte: '2026-12-01',
      grupoId: undefined,
      imunoCodigo: undefined,
    }));
  });

  it('200 with competencia query param — overrides competenciaAte', async () => {
    const res = await request(app)
      .get('/api/vacina/cobertura?ano=2026&competencia=2026-06')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(getCobertura).toHaveBeenCalledWith(expect.objectContaining({ competenciaAte: '2026-06-01' }));
  });

  it('falls back to default competenciaAte when competencia is invalid', async () => {
    const res = await request(app)
      .get('/api/vacina/cobertura?ano=2026&competencia=not-a-date')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(getCobertura).toHaveBeenCalledWith(expect.objectContaining({ competenciaAte: '2026-12-01' }));
  });

  it('200 with grupo_id and imuno_codigo (optional branches)', async () => {
    const res = await request(app)
      .get('/api/vacina/cobertura?ano=2026&grupo_id=1&imuno_codigo=93')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(getCobertura).toHaveBeenCalledWith(expect.objectContaining({ grupoId: 1, imunoCodigo: '93' }));
  });
});

// ── GET /cargas ───────────────────────────────────────────────────────────────

describe('GET /api/vacina/cargas', () => {
  it('200 returns rows from db', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, competencia: '2026-01-01' }] });
    const res = await request(app).get('/api/vacina/cargas').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

// ── GET list endpoints ────────────────────────────────────────────────────────

describe('GET /api/vacina/imunobiologicos', () => {
  it('200 returns list', async () => {
    const res = await request(app).get('/api/vacina/imunobiologicos').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body[0].imuno_codigo).toBe('93');
  });
});

describe('GET /api/vacina/grupos', () => {
  it('200 returns groups', async () => {
    const res = await request(app).get('/api/vacina/grupos').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('GET /api/vacina/faixa-grupo', () => {
  it('200 returns faixa mapping', async () => {
    const res = await request(app).get('/api/vacina/faixa-grupo').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body[0].faixa_nies).toBe('05 a 11 anos');
  });
});

describe('GET /api/vacina/populacao', () => {
  it('200 without ano param', async () => {
    const res = await request(app).get('/api/vacina/populacao').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(listPopulacao).toHaveBeenCalledWith(null);
  });

  it('200 with ano param', async () => {
    const res = await request(app).get('/api/vacina/populacao?ano=2026').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(listPopulacao).toHaveBeenCalledWith(2026);
  });
});

describe('GET /api/vacina/esquema', () => {
  it('200 returns esquema list', async () => {
    const res = await request(app).get('/api/vacina/esquema').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

// ── POST /grupos ──────────────────────────────────────────────────────────────

describe('POST /api/vacina/grupos', () => {
  it('201 planning staff', async () => {
    const res = await request(app)
      .post('/api/vacina/grupos')
      .set('Authorization', authHeader())
      .send({ nome: 'Criança', slug: 'crianca', ordem: 2 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(2);
    expect(createGrupo).toHaveBeenCalledTimes(1);
  });

  it('403 for non-planning staff profile', async () => {
    const res = await request(app)
      .post('/api/vacina/grupos')
      .set('Authorization', unidadeHeader())
      .send({ nome: 'Criança' });
    expect(res.status).toBe(403);
    expect(createGrupo).not.toHaveBeenCalled();
  });

  it('401 without auth', async () => {
    const res = await request(app).post('/api/vacina/grupos').send({ nome: 'X' });
    expect(res.status).toBe(401);
  });
});

// ── PUT /grupos/:id ───────────────────────────────────────────────────────────

describe('PUT /api/vacina/grupos/:id', () => {
  it('200 updates grupo', async () => {
    const res = await request(app)
      .put('/api/vacina/grupos/1')
      .set('Authorization', authHeader())
      .send({ nome: 'Adolescente' });
    expect(res.status).toBe(200);
    expect(updateGrupo).toHaveBeenCalledWith(1, expect.objectContaining({ nome: 'Adolescente' }));
  });

  it('403 for non-planning staff', async () => {
    const res = await request(app)
      .put('/api/vacina/grupos/1')
      .set('Authorization', unidadeHeader())
      .send({ nome: 'X' });
    expect(res.status).toBe(403);
  });
});

// ── PUT /faixa-grupo/:faixa ───────────────────────────────────────────────────

describe('PUT /api/vacina/faixa-grupo/:faixa', () => {
  it('200 with grupo_id', async () => {
    const res = await request(app)
      .put('/api/vacina/faixa-grupo/05%20a%2011%20anos')
      .set('Authorization', authHeader())
      .send({ grupo_id: 1 });
    expect(res.status).toBe(200);
    expect(setFaixaGrupo).toHaveBeenCalledWith('05 a 11 anos', 1);
  });

  it('200 with grupo_id null (unmap branch)', async () => {
    setFaixaGrupo.mockResolvedValueOnce({ faixa_nies: '05 a 11 anos', grupo_id: null });
    const res = await request(app)
      .put('/api/vacina/faixa-grupo/05%20a%2011%20anos')
      .set('Authorization', authHeader())
      .send({ grupo_id: null });
    expect(res.status).toBe(200);
    // grupo_id ?? null → null when body.grupo_id is null
    expect(setFaixaGrupo).toHaveBeenCalledWith('05 a 11 anos', null);
  });

  it('200 with grupo_id omitted (undefined → null via ?? null)', async () => {
    setFaixaGrupo.mockResolvedValueOnce({ faixa_nies: '05 a 11 anos', grupo_id: null });
    const res = await request(app)
      .put('/api/vacina/faixa-grupo/05%20a%2011%20anos')
      .set('Authorization', authHeader())
      .send({});
    expect(res.status).toBe(200);
    expect(setFaixaGrupo).toHaveBeenCalledWith('05 a 11 anos', null);
  });
});

// ── POST /populacao ───────────────────────────────────────────────────────────

describe('POST /api/vacina/populacao', () => {
  it('400 when fields are non-numeric', async () => {
    const res = await request(app)
      .post('/api/vacina/populacao')
      .set('Authorization', authHeader())
      .send({ ano: 'x', grupo_id: 1, populacao: 500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/numéricos/i);
    expect(upsertPopulacao).not.toHaveBeenCalled();
  });

  it('400 when grupo_id is missing', async () => {
    const res = await request(app)
      .post('/api/vacina/populacao')
      .set('Authorization', authHeader())
      .send({ ano: 2026, populacao: 500 });
    expect(res.status).toBe(400);
  });

  it('400 when populacao is missing', async () => {
    const res = await request(app)
      .post('/api/vacina/populacao')
      .set('Authorization', authHeader())
      .send({ ano: 2026, grupo_id: 1 });
    expect(res.status).toBe(400);
  });

  it('201 on valid payload', async () => {
    const res = await request(app)
      .post('/api/vacina/populacao')
      .set('Authorization', authHeader())
      .send({ ano: 2026, grupo_id: 1, populacao: 500 });
    expect(res.status).toBe(201);
    expect(upsertPopulacao).toHaveBeenCalledWith({ ano: 2026, grupo_id: 1, populacao: 500 });
  });
});

// ── POST /esquema ─────────────────────────────────────────────────────────────

describe('POST /api/vacina/esquema', () => {
  it('400 when imuno_codigo missing', async () => {
    const res = await request(app)
      .post('/api/vacina/esquema')
      .set('Authorization', authHeader())
      .send({ grupo_id: 1, num_doses: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/imuno_codigo/i);
  });

  it('400 when imuno_codigo is not a string (number)', async () => {
    const res = await request(app)
      .post('/api/vacina/esquema')
      .set('Authorization', authHeader())
      .send({ imuno_codigo: 93, grupo_id: 1, num_doses: 2 });
    expect(res.status).toBe(400);
  });

  it('400 when grupo_id is non-numeric', async () => {
    const res = await request(app)
      .post('/api/vacina/esquema')
      .set('Authorization', authHeader())
      .send({ imuno_codigo: '93', grupo_id: 'abc', num_doses: 2 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/grupo_id/i);
  });

  it('400 when num_doses <= 0', async () => {
    const res = await request(app)
      .post('/api/vacina/esquema')
      .set('Authorization', authHeader())
      .send({ imuno_codigo: '93', grupo_id: 1, num_doses: 0 });
    expect(res.status).toBe(400);
  });

  it('400 when num_doses is negative', async () => {
    const res = await request(app)
      .post('/api/vacina/esquema')
      .set('Authorization', authHeader())
      .send({ imuno_codigo: '93', grupo_id: 1, num_doses: -1 });
    expect(res.status).toBe(400);
  });

  it('201 on valid payload', async () => {
    const res = await request(app)
      .post('/api/vacina/esquema')
      .set('Authorization', authHeader())
      .send({ imuno_codigo: '93', grupo_id: 1, num_doses: 2 });
    expect(res.status).toBe(201);
    expect(upsertEsquema).toHaveBeenCalledWith({ imuno_codigo: '93', grupo_id: 1, num_doses: 2 });
  });

  it('403 for non-planning staff', async () => {
    const res = await request(app)
      .post('/api/vacina/esquema')
      .set('Authorization', unidadeHeader())
      .send({ imuno_codigo: '93', grupo_id: 1, num_doses: 2 });
    expect(res.status).toBe(403);
  });
});

// ── DELETE /esquema/:id ───────────────────────────────────────────────────────

describe('DELETE /api/vacina/esquema/:id', () => {
  it('200 deletes esquema', async () => {
    const res = await request(app)
      .delete('/api/vacina/esquema/1')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(deleteEsquema).toHaveBeenCalledWith(1);
  });

  it('403 for non-planning staff', async () => {
    const res = await request(app)
      .delete('/api/vacina/esquema/1')
      .set('Authorization', unidadeHeader());
    expect(res.status).toBe(403);
  });
});

// ── POST /importacao/preview — no-file branch ─────────────────────────────────

describe('POST /api/vacina/importacao/preview', () => {
  it('400 when no file attached', async () => {
    const res = await request(app)
      .post('/api/vacina/importacao/preview')
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/arquivo/i);
    expect(parseUpload).not.toHaveBeenCalled();
  });

  it('403 for non-planning staff', async () => {
    const res = await request(app)
      .post('/api/vacina/importacao/preview')
      .set('Authorization', unidadeHeader());
    expect(res.status).toBe(403);
  });

  it('200 with file attached (mocked parseUpload + analisarPreview)', async () => {
    const res = await request(app)
      .post('/api/vacina/importacao/preview')
      .set('Authorization', authHeader())
      .attach('arquivo', Buffer.from('x'), 'vacina_jan_2026.xlsx');
    expect(res.status).toBe(200);
    expect(parseUpload).toHaveBeenCalledTimes(1);
    expect(analisarPreview).toHaveBeenCalledTimes(1);
  });

  it('422 when parseUpload returns no competencia', async () => {
    parseUpload.mockResolvedValueOnce({
      competencia: null,
      doses_total: 0,
      arquivo_nome: 'x.xlsx',
      linhas: [],
    });
    const res = await request(app)
      .post('/api/vacina/importacao/preview')
      .set('Authorization', authHeader())
      .attach('arquivo', Buffer.from('x'), 'vacina_jan_2026.xlsx');
    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/competência/i);
    expect(analisarPreview).not.toHaveBeenCalled();
  });
});

// ── POST /importacao — branches ───────────────────────────────────────────────

describe('POST /api/vacina/importacao', () => {
  it('400 when no file attached', async () => {
    const res = await request(app)
      .post('/api/vacina/importacao')
      .set('Authorization', authHeader());
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/arquivo/i);
  });

  it('403 for non-planning staff', async () => {
    const res = await request(app)
      .post('/api/vacina/importacao')
      .set('Authorization', unidadeHeader());
    expect(res.status).toBe(403);
  });

  it('422 when parser returns no competencia and none provided in body', async () => {
    parseUpload.mockResolvedValueOnce({
      competencia: null,
      doses_total: 0,
      arquivo_nome: 'x.xlsx',
      linhas: [],
    });
    const res = await request(app)
      .post('/api/vacina/importacao')
      .set('Authorization', authHeader())
      .attach('arquivo', Buffer.from('x'), 'vacina_jan_2026.xlsx');
    expect(res.status).toBe(422);
    expect(gravarCarga).not.toHaveBeenCalled();
  });

  it('400 when body.competencia is malformed', async () => {
    parseUpload.mockResolvedValueOnce({
      competencia: null,
      doses_total: 0,
      arquivo_nome: 'x.xlsx',
      linhas: [],
    });
    const res = await request(app)
      .post('/api/vacina/importacao')
      .set('Authorization', authHeader())
      .field('competencia', 'not-a-month')
      .attach('arquivo', Buffer.from('x'), 'vacina_jan_2026.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/competencia/i);
    expect(gravarCarga).not.toHaveBeenCalled();
  });

  it('201 with file and valid body.competencia overriding null from parser', async () => {
    parseUpload.mockResolvedValueOnce({
      competencia: null,
      doses_total: 3,
      arquivo_nome: 'vacina_jan_2026.xlsx',
      linhas: [],
    });
    const res = await request(app)
      .post('/api/vacina/importacao')
      .set('Authorization', authHeader())
      .field('competencia', '2026-01')
      .attach('arquivo', Buffer.from('x'), 'vacina_jan_2026.xlsx');
    expect(res.status).toBe(201);
    expect(gravarCarga).toHaveBeenCalledWith(
      expect.objectContaining({ competencia: '2026-01-01' }),
      null
    );
  });

  it('201 when parser already provides competencia (no body override)', async () => {
    const res = await request(app)
      .post('/api/vacina/importacao')
      .set('Authorization', authHeader())
      .attach('arquivo', Buffer.from('x'), 'vacina_jan_2026.xlsx');
    expect(res.status).toBe(201);
    expect(gravarCarga).toHaveBeenCalledTimes(1);
  });
});
