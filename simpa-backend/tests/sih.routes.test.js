'use strict';

jest.mock('../src/services/db');
jest.mock('../src/services/sih');
jest.mock('../src/services/consolidator');
jest.mock('../src/services/sihProducaoService');

const request = require('supertest');
const { query } = require('../src/services/db');
const {
  sincronizar,
  getSyncProgress,
  getCompetenciaImportada,
  listSincronizacoes,
} = require('../src/services/sih');
const { runConsolidation } = require('../src/services/consolidator');
const { listInternacoes, listProcedimentos } = require('../src/services/sihProducaoService');
const { authHeader, unidadeHeader } = require('./helpers/auth');
const app = require('../src/app');

const defaultSyncResult = {
  sincronizacao_id: 1,
  competencia: '2025-01-01',
  status: 'ok',
  qtd_internacoes: 42,
  qtd_procedimentos: 110,
  orphan_cnes: 0,
  erros: 0,
};

beforeEach(() => {
  jest.clearAllMocks();
  query.mockResolvedValue({ rows: [] });
  getCompetenciaImportada.mockResolvedValue({ exists: false });
  listSincronizacoes.mockResolvedValue([]);
  sincronizar.mockResolvedValue(defaultSyncResult);
  runConsolidation.mockResolvedValue({ ok: true, result: { status: 'ok' } });
  listInternacoes.mockResolvedValue([]);
  listProcedimentos.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// POST /api/sih/sincronizar — validation
// ---------------------------------------------------------------------------

describe('POST /api/sih/sincronizar — validation', () => {
  it('400 for invalid competencia format', async () => {
    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: 'invalid' });

    expect(res.status).toBe(400);
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('400 for month 13 (invalid month)', async () => {
    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-13' });

    expect(res.status).toBe(400);
  });

  it('400 for invalid executionId', async () => {
    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-01', executionId: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/executionId/i);
  });

  it('401 without JWT', async () => {
    const res = await request(app)
      .post('/api/sih/sincronizar')
      .send({ competencia: '2025-01' });

    expect(res.status).toBe(401);
  });

  it('403 for non-planning profile', async () => {
    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', unidadeHeader())
      .send({ competencia: '2025-01' });

    expect(res.status).toBe(403);
    expect(sincronizar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/sih/sincronizar — gate 409
// ---------------------------------------------------------------------------

describe('POST /api/sih/sincronizar — 409 gate', () => {
  it('409 when competencia already imported and reimportar not set', async () => {
    getCompetenciaImportada.mockResolvedValueOnce({
      exists: true,
      status: 'ok',
      qtd_internacoes: 99,
      qtd_procedimentos: 250,
      sincronizado_em: '2025-02-01T10:00:00Z',
    });

    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-01' });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      code: 'SIH_COMPETENCIA_JA_IMPORTADA',
      competencia: '2025-01',
      qtd_internacoes: 99,
      qtd_procedimentos: 250,
    });
    expect(sincronizar).not.toHaveBeenCalled();
  });

  it('proceeds when reimportar=true even if already imported', async () => {
    getCompetenciaImportada.mockResolvedValueOnce({
      exists: true,
      status: 'ok',
      qtd_internacoes: 50,
      qtd_procedimentos: 120,
      sincronizado_em: '2025-02-01T10:00:00Z',
    });

    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-01', reimportar: true });

    expect(res.status).toBe(200);
    expect(sincronizar).toHaveBeenCalledWith('2025-01', {
      reimportar: true,
      executionId: null,
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/sih/sincronizar — success + 503 MySQL
// ---------------------------------------------------------------------------

describe('POST /api/sih/sincronizar — success and 503', () => {
  it('200 on success with consolidation triggered', async () => {
    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-01' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.qtd_internacoes).toBe(42);
    expect(res.body.consolidacao.ok).toBe(true);
    expect(runConsolidation).toHaveBeenCalledWith({ all: true });
  });

  it('503 when MySQL unavailable', async () => {
    sincronizar.mockResolvedValueOnce({
      competencia: '2025-01',
      status: 'erro',
      qtd_internacoes: 0,
      qtd_procedimentos: 0,
      orphan_cnes: 0,
      erros: 0,
      error: 'SIH_MYSQL_UNAVAILABLE',
    });

    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-01' });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('SIH_MYSQL_UNAVAILABLE');
    expect(res.body.message).toMatch(/XAMPP/i);
    expect(runConsolidation).not.toHaveBeenCalled();
  });

  it('consolidates on parcial status', async () => {
    sincronizar.mockResolvedValueOnce({
      ...defaultSyncResult, status: 'parcial', erros: 2,
    });

    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-01' });

    expect(res.status).toBe(200);
    expect(runConsolidation).toHaveBeenCalledWith({ all: true });
  });

  it('skips consolidation on erro status', async () => {
    sincronizar.mockResolvedValueOnce({
      ...defaultSyncResult, status: 'erro', error: 'some_other_error',
    });

    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-01' });

    expect(res.status).toBe(200);
    expect(runConsolidation).not.toHaveBeenCalled();
  });

  it('keeps sync result when consolidation fails', async () => {
    runConsolidation.mockRejectedValueOnce(new Error('consolidate failed'));

    const res = await request(app)
      .post('/api/sih/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2025-01' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.consolidacao).toEqual({ ok: false, error: 'consolidate failed' });
  });
});

// ---------------------------------------------------------------------------
// GET /api/sih/sincronizacoes/existe
// ---------------------------------------------------------------------------

describe('GET /api/sih/sincronizacoes/existe', () => {
  it('200 with exists=true when found', async () => {
    getCompetenciaImportada.mockResolvedValueOnce({
      exists: true,
      status: 'ok',
      qtd_internacoes: 80,
      qtd_procedimentos: 200,
      sincronizado_em: '2025-02-01T08:00:00Z',
    });

    const res = await request(app)
      .get('/api/sih/sincronizacoes/existe')
      .query({ competencia: '2025-01' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
    expect(res.body.qtd_internacoes).toBe(80);
  });

  it('400 for invalid competencia', async () => {
    const res = await request(app)
      .get('/api/sih/sincronizacoes/existe')
      .query({ competencia: '202501' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /api/sih/sincronizacoes
// ---------------------------------------------------------------------------

describe('GET /api/sih/sincronizacoes', () => {
  it('401 without JWT', async () => {
    const res = await request(app).get('/api/sih/sincronizacoes');
    expect(res.status).toBe(401);
  });

  it('200 with history array including qtd_aih and por_cnes', async () => {
    listSincronizacoes.mockResolvedValueOnce([{
      id: 1,
      competencia: '2025-01-01',
      status: 'ok',
      qtd_aih: 801,
      qtd_internacoes: 496,
      qtd_procedimentos: 839,
      orphan_cnes: 0,
      erros: 0,
      sincronizado_em: '2025-02-01T10:00:00Z',
      por_cnes: [
        {
          cnes: '2058790',
          unidade: 'HOSPITAL MUNICIPAL',
          qtd_aih: 779,
          qtd_internacoes: 480,
          qtd_procedimentos: 820,
        },
      ],
    }]);

    const res = await request(app)
      .get('/api/sih/sincronizacoes')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('ok');
    expect(res.body[0].qtd_aih).toBe(801);
    expect(res.body[0].por_cnes).toHaveLength(1);
    expect(res.body[0].por_cnes[0].cnes).toBe('2058790');
    expect(listSincronizacoes).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/sih/sincronizar/progresso/:executionId
// ---------------------------------------------------------------------------

describe('GET /api/sih/sincronizar/progresso/:id', () => {
  it('404 for unknown executionId', async () => {
    getSyncProgress.mockReturnValueOnce(null);

    const res = await request(app)
      .get('/api/sih/sincronizar/progresso/not-found-id-abc')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('200 with progress object when found', async () => {
    getSyncProgress.mockReturnValueOnce({
      executionId: 'sih_test_exec_001',
      status: 'running',
      stage: 'extracao_mysql',
      events: [],
    });

    const res = await request(app)
      .get('/api/sih/sincronizar/progresso/sih_test_exec_001')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
  });
});

// ---------------------------------------------------------------------------
// GET /api/sih/internacoes + procedimentos
// ---------------------------------------------------------------------------

describe('GET /api/sih/internacoes and /procedimentos', () => {
  it('GET /internacoes returns array', async () => {
    listInternacoes.mockResolvedValueOnce([
      { cnes: '1234567', qtd_aih: 10, total_valor: '5000.00' },
    ]);

    const res = await request(app)
      .get('/api/sih/internacoes')
      .query({ competencia: '2025-01' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(listInternacoes).toHaveBeenCalledWith(
      expect.objectContaining({ competencia: '2025-01' })
    );
  });

  it('GET /procedimentos returns array', async () => {
    listProcedimentos.mockResolvedValueOnce([
      { cnes: '1234567', proc_detalhado: '0301010010', total_quantidade: 5 },
    ]);

    const res = await request(app)
      .get('/api/sih/procedimentos')
      .query({ competencia: '2025-01' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});
