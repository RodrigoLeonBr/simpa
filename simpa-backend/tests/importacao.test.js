jest.mock('../src/services/db');
jest.mock('../src/services/parser');
jest.mock('../src/services/consolidator');
jest.mock('../src/services/importMappingService', () => ({
  ...jest.requireActual('../src/services/importMappingService'),
  enrichPreviewItem: jest.fn(),
  resolveForUpload: jest.fn(),
  listMapeamentos: jest.fn(),
  upsertMapeamento: jest.fn(),
  deactivateMapeamento: jest.fn(),
}));
jest.mock('../src/services/storage', () => ({
  ...jest.requireActual('../src/services/storage'),
  hashFile: jest.fn(() => 'abc123hash'),
  moveFile: jest.fn(),
  removeFile: jest.fn(),
  removeTempFile: jest.fn(),
}));

const request = require('supertest');
const { query } = require('../src/services/db');
const { preview, processar } = require('../src/services/parser');
const { runConsolidation } = require('../src/services/consolidator');
const {
  enrichPreviewItem,
  resolveForUpload,
  listMapeamentos,
  upsertMapeamento,
  deactivateMapeamento,
} = require('../src/services/importMappingService');
const { buildPath } = require('../src/services/storage');
const { authHeader, unidadeHeader } = require('./helpers/auth');
const app = require('../src/app');

const sampleMeta = {
  tipo_relatorio: 'atendimento_individual',
  competencia: '2026-05-01',
  unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
  equipe_nome: 'EQUIPE 9 EAP',
  equipe_codigo: '0002200376',
  arquivo_origem: 'relatorio.csv',
};

const sampleResolucao = {
  arquivo: 'relatorio.csv',
  estabelecimento_id: 42,
  equipe_id: 7,
  salvar_mapeamento: false,
};

const enrichedPending = {
  nome: 'relatorio.csv',
  tipo_relatorio: 'atendimento_individual',
  competencia: '2026-05',
  esus_unidade: sampleMeta.unidade,
  esus_equipe_nome: sampleMeta.equipe_nome,
  esus_equipe_codigo: sampleMeta.equipe_codigo,
  mapeamento_status: 'pending',
  sugestoes_estabelecimento: [{ id: 42, codigo_externo: '7169698', nome: 'CAFI', score: 0.9 }],
  ja_importado: false,
};

const enrichedResolved = {
  ...enrichedPending,
  mapeamento_status: 'resolved',
  estabelecimento_id: 42,
  estabelecimento_codigo: '7169698',
  estabelecimento_nome: 'CAFI - CENTRO',
  equipe_id: 7,
  equipe_nome: 'EQUIPE 9 EAP',
  sugestoes_estabelecimento: undefined,
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
    enrichPreviewItem.mockResolvedValue(enrichedResolved);
    resolveForUpload.mockResolvedValue({
      estabelecimentoId: 42,
      equipeId: 7,
      estabelecimentoNome: 'CAFI',
      equipeNome: 'EQUIPE 9 EAP',
    });
    listMapeamentos.mockResolvedValue({ data: [], pagination: { page: 1, limit: 50, total: 0, pages: 1 } });
    upsertMapeamento.mockResolvedValue({
      id: 1,
      esus_unidade_label: sampleMeta.unidade,
      estabelecimento_id: 42,
    });
    deactivateMapeamento.mockResolvedValue({ inativado: true, id: 1 });
  });

  it('POST /preview returns enriched mapping metadata without DB write', async () => {
    const res = await request(app)
      .post('/api/importacao/preview')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(200);
    expect(res.body[0].mapeamento_status).toBe('resolved');
    expect(res.body[0].estabelecimento_id).toBe(42);
    expect(enrichPreviewItem).toHaveBeenCalled();
    expect(processar).not.toHaveBeenCalled();
  });

  it('POST /preview returns pending status for unknown e-SUS unit label', async () => {
    enrichPreviewItem.mockResolvedValueOnce(enrichedPending);

    const res = await request(app)
      .post('/api/importacao/preview')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(200);
    expect(res.body[0].mapeamento_status).toBe('pending');
    expect(res.body[0].sugestoes_estabelecimento).toHaveLength(1);
  });

  it('POST /preview returns resolved mapping when registry hit', async () => {
    const res = await request(app)
      .post('/api/importacao/preview')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(200);
    expect(res.body[0].mapeamento_status).toBe('resolved');
    expect(res.body[0].equipe_id).toBe(7);
  });

  it('POST /upload saves file, parses and consolidates with resolved IDs', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field('resolucoes', JSON.stringify([sampleResolucao]))
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(201);
    expect(res.body[0].carga_id).toBe(42);
    expect(res.body[0].estabelecimento_id).toBe(42);
    expect(res.body[0].consolidacao.ok).toBe(true);
    expect(resolveForUpload).toHaveBeenCalled();
    expect(processar).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ estabelecimentoId: 42, equipeId: 7 })
    );
    expect(runConsolidation).toHaveBeenCalledWith(
      expect.objectContaining({
        competencia: '2026-05',
        estabelecimentoId: 42,
        equipeId: 7,
      })
    );
    expect(buildPath('2026-05', sampleMeta.unidade, 'relatorio.csv')).toContain('esus');
  });

  it('POST /upload without resolucoes returns 400', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/resolucoes/i);
  });

  it('POST /upload rejects malformed resolucoes JSON string', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field('resolucoes', '{invalid-json')
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/resolucoes/i);
  });

  it('POST /upload rejects missing resolucao for uploaded file', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field(
        'resolucoes',
        JSON.stringify([{ ...sampleResolucao, arquivo: 'outro.csv' }])
      )
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Resolução ausente/i);
  });

  it('POST /upload maps resolve validation errors to 400', async () => {
    const err = new Error('estabelecimento_id é obrigatório');
    err.status = 400;
    resolveForUpload.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field('resolucoes', JSON.stringify([sampleResolucao]))
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/estabelecimento_id/i);
  });

  it('POST /upload with Todas conflict without confirm returns 409', async () => {
    const err = new Error('Conflito "Todas": confirme a remoção das importações agregadas');
    err.status = 409;
    err.conflito_todas = { exists: true, cargas_ids: [99], requires_confirm: true };
    resolveForUpload.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field('resolucoes', JSON.stringify([sampleResolucao]))
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(409);
    expect(res.body.conflito_todas).toBeDefined();
  });

  it('POST /upload rejects non-planning user', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', unidadeHeader())
      .field('resolucoes', JSON.stringify([sampleResolucao]))
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(403);
  });

  it('GET /cargas lists history with cadastro fields', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          tipo_relatorio: 'atendimento_individual',
          estabelecimento_id: 42,
          equipe_id: 7,
          estabelecimento_nome: 'CAFI',
          equipe_cadastro_nome: 'EQUIPE 9 EAP',
        },
      ],
    });

    const res = await request(app)
      .get('/api/importacao/cargas')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body[0].estabelecimento_id).toBe(42);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('estabelecimento_id'),
      expect.any(Array)
    );
  });

  it('GET /mapeamentos lists mappings', async () => {
    listMapeamentos.mockResolvedValueOnce({
      data: [{ id: 1, esus_unidade_label: sampleMeta.unidade }],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    });

    const res = await request(app)
      .get('/api/importacao/mapeamentos')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('POST /mapeamentos creates mapping for planning staff', async () => {
    const res = await request(app)
      .post('/api/importacao/mapeamentos')
      .set('Authorization', authHeader())
      .send({
        esus_unidade_label: sampleMeta.unidade,
        estabelecimento_id: 42,
      });

    expect(res.status).toBe(201);
    expect(upsertMapeamento).toHaveBeenCalled();
  });

  it('POST /mapeamentos without planning role returns 403', async () => {
    const res = await request(app)
      .post('/api/importacao/mapeamentos')
      .set('Authorization', unidadeHeader())
      .send({
        esus_unidade_label: sampleMeta.unidade,
        estabelecimento_id: 42,
      });

    expect(res.status).toBe(403);
  });

  it('DELETE /mapeamentos/:id soft-deletes for planning staff', async () => {
    const res = await request(app)
      .delete('/api/importacao/mapeamentos/5')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(deactivateMapeamento).toHaveBeenCalledWith('5', expect.objectContaining({ perfil: 'Administrador' }));
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
          estabelecimento_id: 42,
          equipe_id: 7,
        },
      ],
    });

    const res = await request(app)
      .post('/api/importacao/5/reprocessar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(processar).toHaveBeenCalledWith(
      '/uploads/esus/2026/05/u/file.csv',
      expect.objectContaining({ estabelecimentoId: 42, equipeId: 7 })
    );
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
      .set('Authorization', authHeader())
      .field('resolucoes', JSON.stringify([sampleResolucao]));

    expect(res.status).toBe(400);
  });

  it('POST /upload returns 422 row error for undetectable CSV', async () => {
    preview.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field('resolucoes', JSON.stringify([sampleResolucao]))
      .attach('files', Buffer.from('bad'), 'relatorio.csv');

    expect(res.status).toBe(422);
    expect(res.body[0].error).toMatch(/metadados/i);
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
            estabelecimento_id: 42,
            equipe_id: 7,
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
      .field('resolucoes', JSON.stringify([sampleResolucao]))
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
      expect.stringContaining('c.competencia = $1'),
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

  it('POST /upload rejects invalid resolucoes JSON', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field('resolucoes', '{invalid')
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(400);
  });

  it('POST /upload rejects resolucao missing for uploaded filename', async () => {
    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field(
        'resolucoes',
        JSON.stringify([{ ...sampleResolucao, arquivo: 'outro.csv' }])
      )
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/relatorio\.csv/);
  });

  it('POST /preview captures parser errors per file', async () => {
    preview.mockRejectedValueOnce(new Error('parser timeout'));

    const res = await request(app)
      .post('/api/importacao/preview')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('csv'), 'relatorio.csv');

    expect(res.status).toBe(200);
    expect(res.body[0].error).toMatch(/parser timeout/);
  });

  it('PUT /mapeamentos/:id updates mapping for planning staff', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          esus_unidade_label: sampleMeta.unidade,
          esus_equipe_codigo: null,
          esus_equipe_nome: null,
        },
      ],
    });

    const res = await request(app)
      .put('/api/importacao/mapeamentos/3')
      .set('Authorization', authHeader())
      .send({ estabelecimento_id: 42, equipe_id: 7 });

    expect(res.status).toBe(200);
    expect(upsertMapeamento).toHaveBeenCalled();
  });

  it('DELETE /mapeamentos/:id returns 404 when missing', async () => {
    deactivateMapeamento.mockRejectedValueOnce(
      Object.assign(new Error('Mapeamento não encontrado'), { status: 404 })
    );

    const res = await request(app)
      .delete('/api/importacao/mapeamentos/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('POST /:id/reprocessar uses legacy consolidation without FKs', async () => {
    query.mockReset();
    query.mockResolvedValue({
      rows: [
        {
          id: 6,
          arquivo_path: '/uploads/file.csv',
          competencia: '2026-05-01',
          unidade: sampleMeta.unidade,
          equipe_nome: sampleMeta.equipe_nome,
          estabelecimento_id: null,
          equipe_id: null,
        },
      ],
    });

    const res = await request(app)
      .post('/api/importacao/6/reprocessar')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(processar).toHaveBeenCalledWith('/uploads/file.csv', {});
    expect(runConsolidation).toHaveBeenCalledWith(
      expect.objectContaining({
        unidade: sampleMeta.unidade,
        equipe: sampleMeta.equipe_nome,
      })
    );
  });

  it('preview marks undetectable file with error field', async () => {
    preview.mockResolvedValueOnce([]);

    const res = await request(app)
      .post('/api/importacao/preview')
      .set('Authorization', authHeader())
      .attach('files', Buffer.from('bad'), 'bad.csv');

    expect(res.status).toBe(200);
    expect(res.body[0].error).toMatch(/metadados/i);
    expect(enrichPreviewItem).not.toHaveBeenCalled();
  });
});
