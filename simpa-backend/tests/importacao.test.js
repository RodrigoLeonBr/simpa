jest.mock('../src/services/db');
jest.mock('../src/services/parser');
jest.mock('../src/services/consolidator');
jest.mock('../src/services/storage', () => ({
  ...jest.requireActual('../src/services/storage'),
  hashFile: jest.fn(() => 'abc123hash'),
  moveFile: jest.fn(),
  removeFile: jest.fn(),
  removeTempFile: jest.fn(),
}));

const path = require('path');
const request = require('supertest');
const { query } = require('../src/services/db');
const { preview, processar } = require('../src/services/parser');
const { runConsolidation } = require('../src/services/consolidator');
const { buildPath } = require('../src/services/storage');
const { authHeader } = require('./helpers/auth');
const app = require('../src/app');

const sampleMeta = {
  tipo_relatorio: 'atendimento_individual',
  competencia: '2026-05-01',
  unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
  equipe_nome: 'EQUIPE 9 EAP',
  arquivo_origem: 'relatorio.csv',
};

describe('importacao routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
    preview.mockResolvedValue([{ ...sampleMeta, sections_count: 3 }]);
    processar.mockResolvedValue([
      { carga_id: 42, status: 'ok', tipo_relatorio: 'atendimento_individual' },
    ]);
    runConsolidation.mockResolvedValue({ ok: true, result: { status: 'ok' } });
  });

  it('POST /preview returns metadata without DB write', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 7 }] });

    const res = await request(app)
      .post('/api/importacao/preview')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(200);
    expect(res.body[0].tipo_relatorio).toBe('atendimento_individual');
    expect(res.body[0].ja_importado).toBe(true);
    expect(processar).not.toHaveBeenCalled();
  });

  it('POST /upload saves file, parses and consolidates', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(201);
    expect(res.body[0].carga_id).toBe(42);
    expect(res.body[0].consolidacao.ok).toBe(true);
    expect(processar).toHaveBeenCalled();
    expect(runConsolidation).toHaveBeenCalledWith(
      expect.objectContaining({
        competencia: '2026-05',
        unidade: sampleMeta.unidade,
        equipe: sampleMeta.equipe_nome,
      })
    );
    expect(buildPath('2026-05', sampleMeta.unidade, 'relatorio.csv')).toContain('esus');
  });

  it('GET /cargas lists history', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, tipo_relatorio: 'atendimento_individual' }],
    });

    const res = await request(app)
      .get('/api/importacao/cargas')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('POST /:id/reprocessar reruns parser', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 5,
          arquivo_path: '/uploads/esus/2026/05/u/file.csv',
          competencia: '2026-05-01',
          unidade: sampleMeta.unidade,
          equipe_nome: sampleMeta.equipe_nome,
        },
      ],
    });

    const res = await request(app)
      .post('/api/importacao/5/reprocessar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(processar).toHaveBeenCalledWith('/uploads/esus/2026/05/u/file.csv');
  });

  it('DELETE /:id removes carga', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 9, arquivo_path: '/tmp/x.csv' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .delete('/api/importacao/9')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(query).toHaveBeenCalledWith('DELETE FROM esus_cargas WHERE id = $1', ['9']);
  });

  it('requires JWT', async () => {
    const res = await request(app).get('/api/importacao/cargas');
    expect(res.status).toBe(401);
  });

  it('POST /preview without files returns 400', async () => {
    const res = await request(app)
      .post('/api/importacao/preview')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  it('POST /upload without files returns 400', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  it('POST /upload rejects undetectable CSV', async () => {
    preview.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('bad'), 'bad.csv');

    expect(res.status).toBe(422);
  });

  it('POST /:id/reprocessar returns 404 when missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/importacao/999/reprocessar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('POST /:id/reprocessar returns 400 without arquivo_path', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 3, arquivo_path: null, competencia: '2026-05-01' }],
    });

    const res = await request(app)
      .post('/api/importacao/3/reprocessar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  it('PUT /:id/substituir replaces file and reprocesses', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            arquivo_path: '/old/path.csv',
            competencia: '2026-05-01',
            unidade: sampleMeta.unidade,
            equipe_nome: sampleMeta.equipe_nome,
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .put('/api/importacao/11/substituir')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('csv'), 'novo.csv');

    expect(res.status).toBe(200);
    expect(processar).toHaveBeenCalled();
  });

  it('DELETE /:id returns 404 when missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/importacao/404')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('POST /upload continues when consolidation fails', async () => {
    runConsolidation.mockRejectedValueOnce(new Error('consolidate down'));

    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(201);
    expect(res.body[0].consolidacao.ok).toBe(false);
  });

  it('GET /cargas supports competencia and unidade filters', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/importacao/cargas')
      .query({ competencia: '2026-05', unidade: 'CAFI' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('competencia = $1'),
      expect.arrayContaining(['2026-05-01'])
    );
  });

  it('PUT /:id/substituir returns 404 when carga missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/importacao/88/substituir')
      .set('Authorization', authHeader())
      .attach('file', Buffer.from('csv'), 'novo.csv');

    expect(res.status).toBe(404);
  });

  it('PUT /:id/substituir requires file', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, arquivo_path: '/x.csv' }] });

    const res = await request(app)
      .put('/api/importacao/1/substituir')
      .set('Authorization', authHeader());

    expect(res.status).toBe(400);
  });

  it('preview marks undetectable file with error field', async () => {
    preview.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/importacao/preview')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('bad'), 'bad.csv');

    expect(res.status).toBe(200);
    expect(res.body[0].error).toMatch(/metadados/i);
  });
});
