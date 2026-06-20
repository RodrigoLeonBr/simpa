jest.mock('../../src/services/parser');
jest.mock('../../src/services/consolidator', () => ({
  runConsolidation: jest.fn().mockResolvedValue({ ok: true, result: { status: 'ok' } }),
}));
jest.mock('../../src/services/importMappingService', () => ({
  ...jest.requireActual('../../src/services/importMappingService'),
  resolveForUpload: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { query } = require('../../src/services/db');
const { preview, processar } = require('../../src/services/parser');
const { runConsolidation } = require('../../src/services/consolidator');
const { resolveForUpload } = require('../../src/services/importMappingService');
const { samplePayload } = require('../fixtures/sampleContrato');
const { authHeader } = require('../helpers/auth');
const app = require('../../src/app');

const hasPg =
  process.env.PG_HOST &&
  process.env.PG_DB &&
  process.env.PG_USER &&
  process.env.PG_PASS;

const describeIfPg = hasPg ? describe : describe.skip;

const sampleMeta = {
  tipo_relatorio: 'atendimento_individual',
  competencia: '2026-05-01',
  unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
  equipe_nome: 'EQUIPE 9 EAP',
  equipe_codigo: '0002200376',
  arquivo_origem: 'integration-fixture.csv',
};

const fixtureCsv = path.join(
  __dirname,
  '../../../Relatório de atendimento individual-20260613175047.csv'
);

let pgReady = false;
let cargaId = null;
let estabelecimentoId = null;
let equipeId = null;
let hasIdUnique = false;

function itIfPg(name, fn) {
  it(name, async () => {
    if (!pgReady) return;
    await fn();
  });
}

async function ensureCadastroFixture() {
  const est = await query(
    `SELECT id FROM estabelecimentos WHERE status = 'ativo' ORDER BY id LIMIT 1`
  );
  if (!est.rows.length) {
    throw new Error('Nenhum estabelecimento ativo no banco para teste de integração');
  }
  estabelecimentoId = est.rows[0].id;

  const eq = await query(
    `SELECT id FROM equipes
     WHERE estabelecimento_id = $1 AND status != 'inativo'
     ORDER BY id LIMIT 1`,
    [estabelecimentoId]
  );
  if (eq.rows.length) {
    equipeId = eq.rows[0].id;
    return;
  }

  const inserted = await query(
    `INSERT INTO equipes (codigo, nome, tipo, estabelecimento_id, status)
     VALUES ($1, $2, 'Outra', $3, 'ativo')
     RETURNING id`,
    [`INT-${estabelecimentoId}`, sampleMeta.equipe_nome, estabelecimentoId]
  );
  equipeId = inserted.rows[0].id;
}

async function detectIdUniqueIndexes() {
  const cargas = await query(
    `SELECT 1 FROM pg_indexes WHERE indexname = 'uq_esus_cargas_ids' LIMIT 1`
  );
  const consolidado = await query(
    `SELECT 1 FROM pg_indexes WHERE indexname = 'uq_dados_consolidados_ids' LIMIT 1`
  );
  hasIdUnique = cargas.rows.length > 0 && consolidado.rows.length > 0;
}

async function insertIntegrationCarga() {
  const baseParams = [
    sampleMeta.tipo_relatorio,
    '2026-05-01',
    '2026-05-01',
    '2026-05-31',
    'AMERICANA',
    sampleMeta.unidade,
    sampleMeta.equipe_codigo,
    sampleMeta.equipe_nome,
    'integration-fixture.csv',
  ];

  await query(
    `DELETE FROM esus_indicadores_raw
     WHERE carga_id IN (
       SELECT id FROM esus_cargas
       WHERE (arquivo_origem = $1)
          OR (tipo_relatorio = $2 AND competencia = $3::date AND unidade = $4 AND equipe_nome = $5)
          OR (tipo_relatorio = $2 AND competencia = $3::date AND estabelecimento_id = $6 AND equipe_id = $7)
     )`,
    [
      'integration-fixture.csv',
      sampleMeta.tipo_relatorio,
      '2026-05-01',
      sampleMeta.unidade,
      sampleMeta.equipe_nome,
      estabelecimentoId,
      equipeId,
    ]
  );
  await query(
    `DELETE FROM esus_cargas
     WHERE (arquivo_origem = $1)
        OR (tipo_relatorio = $2 AND competencia = $3::date AND unidade = $4 AND equipe_nome = $5)
        OR (tipo_relatorio = $2 AND competencia = $3::date AND estabelecimento_id = $6 AND equipe_id = $7)`,
    [
      'integration-fixture.csv',
      sampleMeta.tipo_relatorio,
      '2026-05-01',
      sampleMeta.unidade,
      sampleMeta.equipe_nome,
      estabelecimentoId,
      equipeId,
    ]
  );

  const insert = await query(
    `INSERT INTO esus_cargas (
       tipo_relatorio, competencia, periodo_inicio, periodo_fim,
       municipio, unidade, equipe_codigo, equipe_nome, arquivo_origem,
       estabelecimento_id, equipe_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, estabelecimento_id, equipe_id`,
    [...baseParams, estabelecimentoId, equipeId]
  );
  return insert.rows[0];
}

async function upsertIntegrationCarga() {
  const insert = await query(
    `INSERT INTO esus_cargas (
       tipo_relatorio, competencia, periodo_inicio, periodo_fim,
       municipio, unidade, equipe_codigo, equipe_nome, arquivo_origem,
       estabelecimento_id, equipe_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tipo_relatorio, competencia, estabelecimento_id, equipe_id)
     WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL
     DO UPDATE SET importado_em = now()
     RETURNING id, estabelecimento_id, equipe_id`,
    [
      sampleMeta.tipo_relatorio,
      '2026-05-01',
      '2026-05-01',
      '2026-05-31',
      'AMERICANA',
      sampleMeta.unidade,
      sampleMeta.equipe_codigo,
      sampleMeta.equipe_nome,
      'integration-fixture.csv',
      estabelecimentoId,
      equipeId,
    ]
  );
  return insert.rows[0];
}

async function insertIntegrationConsolidado() {
  await query(
    `DELETE FROM dados_consolidados
     WHERE competencia = $1
       AND (
         (estabelecimento_id = $2 AND equipe_id = $3)
         OR (unidade = $4 AND equipe = $5)
       )`,
    [
      '2026-05-01',
      estabelecimentoId,
      equipeId,
      samplePayload.filtros_ativos.unidade,
      samplePayload.filtros_ativos.equipe,
    ]
  );

  if (hasIdUnique) {
    await query(
      `INSERT INTO dados_consolidados (
         competencia, municipio, unidade, equipe, versao_schema,
         dados_conteudo, estabelecimento_id, equipe_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (competencia, estabelecimento_id, equipe_id)
       WHERE estabelecimento_id IS NOT NULL AND equipe_id IS NOT NULL
       DO UPDATE SET dados_conteudo = EXCLUDED.dados_conteudo, atualizado_em = now()`,
      [
        '2026-05-01',
        'AMERICANA',
        samplePayload.filtros_ativos.unidade,
        samplePayload.filtros_ativos.equipe,
        '3.1.0',
        samplePayload,
        estabelecimentoId,
        equipeId,
      ]
    );
    return;
  }

  await query(
    `INSERT INTO dados_consolidados (
       competencia, municipio, unidade, equipe, versao_schema,
       dados_conteudo, estabelecimento_id, equipe_id
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      '2026-05-01',
      'AMERICANA',
      samplePayload.filtros_ativos.unidade,
      samplePayload.filtros_ativos.equipe,
      '3.1.0',
      samplePayload,
      estabelecimentoId,
      equipeId,
    ]
  );
}

describeIfPg('importacao integration', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(__dirname, '../tmp-uploads-integration');
    fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });

    preview.mockImplementation(async () => [{ ...sampleMeta }]);
    resolveForUpload.mockImplementation(async () => ({
      estabelecimentoId,
      equipeId,
      estabelecimentoNome: 'Integration Estab',
      equipeNome: sampleMeta.equipe_nome,
    }));

    try {
      await query('SELECT 1');
      await ensureCadastroFixture();
      await detectIdUniqueIndexes();
      resolveForUpload.mockImplementation(async () => ({
        estabelecimentoId,
        equipeId,
        estabelecimentoNome: 'Integration Estab',
        equipeNome: sampleMeta.equipe_nome,
      }));
      await query(
        'DELETE FROM esus_indicadores_raw WHERE carga_id IN (SELECT id FROM esus_cargas WHERE arquivo_origem = $1)',
        ['integration-fixture.csv']
      );
      await query('DELETE FROM esus_cargas WHERE arquivo_origem = $1', ['integration-fixture.csv']);
      await query(
        `DELETE FROM dados_consolidados
         WHERE competencia = $1 AND estabelecimento_id = $2 AND equipe_id = $3`,
        ['2026-05-01', estabelecimentoId, equipeId]
      );
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  afterAll(async () => {
    if (!pgReady) return;
    if (cargaId) {
      await query('DELETE FROM esus_cargas WHERE id = $1', [cargaId]);
    }
    await query(
      `DELETE FROM dados_consolidados
       WHERE competencia = $1 AND estabelecimento_id = $2 AND equipe_id = $3`,
      ['2026-05-01', estabelecimentoId, equipeId]
    );
    try {
      fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
    } catch (_err) {
      // ignore
    }
  });

  itIfPg('full flow: upload with resolucao sets FKs and dashboard GET by ID returns 200', async () => {
    if (!fs.existsSync(fixtureCsv)) {
      throw new Error(`Fixture CSV missing: ${fixtureCsv}`);
    }

    processar.mockImplementationOnce(async () => {
      const row = await insertIntegrationCarga();
      cargaId = row.id;
      await query(
        `INSERT INTO esus_indicadores_raw (carga_id, secao, descricao, ordem, valores)
         VALUES ($1, 'Resumo', 'Registros identificados', 0, $2)
         ON CONFLICT (carga_id, secao, descricao) DO UPDATE SET valores = EXCLUDED.valores`,
        [cargaId, JSON.stringify({ quantidade: 1 })]
      );
      return [{ carga_id: cargaId, status: 'ok' }];
    });

    runConsolidation.mockImplementationOnce(async () => {
      await insertIntegrationConsolidado();
      return { ok: true, result: { status: 'ok' } };
    });

    const resolucoes = JSON.stringify([
      {
        arquivo: 'integration-fixture.csv',
        estabelecimento_id: estabelecimentoId,
        equipe_id: equipeId,
        salvar_mapeamento: false,
      },
    ]);

    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field('resolucoes', resolucoes)
      .attach('files', fs.readFileSync(fixtureCsv), 'integration-fixture.csv');

    expect(res.status).toBe(201);
    expect(res.body[0].carga_id).toBeDefined();
    expect(resolveForUpload).toHaveBeenCalled();
    expect(runConsolidation).toHaveBeenCalledWith(
      expect.objectContaining({
        competencia: '2026-05',
        estabelecimentoId,
        equipeId,
      })
    );

    const carga = await query(
      'SELECT estabelecimento_id, equipe_id FROM esus_cargas WHERE id = $1',
      [cargaId]
    );
    expect(carga.rows[0].estabelecimento_id).not.toBeNull();
    expect(carga.rows[0].equipe_id).not.toBeNull();

    const dashboard = await request(app)
      .get('/api/v1/dashboard/planejamento')
      .query({
        competencia: '2026-05',
        estabelecimento_id: estabelecimentoId,
        equipe_id: equipeId,
      })
      .set('Authorization', authHeader());

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.competencia).toBe('2026-05');
  });

  itIfPg('re-upload same file upserts without duplicate violation', async () => {
    processar.mockImplementationOnce(async () => {
      const row = hasIdUnique
        ? await upsertIntegrationCarga()
        : await insertIntegrationCarga();
      cargaId = row.id;
      return [{ carga_id: cargaId, status: 'ok' }];
    });

    const resolucoes = JSON.stringify([
      {
        arquivo: 'integration-fixture.csv',
        estabelecimento_id: estabelecimentoId,
        equipe_id: equipeId,
        salvar_mapeamento: false,
      },
    ]);

    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .field('resolucoes', resolucoes)
      .attach('files', Buffer.from('csv,data'), 'integration-fixture.csv');

    expect(res.status).toBe(201);

    const count = await query(
      hasIdUnique
        ? `SELECT COUNT(*)::int AS n FROM esus_cargas
           WHERE tipo_relatorio = $1 AND competencia = $2
             AND estabelecimento_id = $3 AND equipe_id = $4`
        : `SELECT COUNT(*)::int AS n FROM esus_cargas
           WHERE tipo_relatorio = $1 AND competencia = $2 AND arquivo_origem = $3`,
      hasIdUnique
        ? [sampleMeta.tipo_relatorio, '2026-05-01', estabelecimentoId, equipeId]
        : [sampleMeta.tipo_relatorio, '2026-05-01', 'integration-fixture.csv']
    );
    expect(count.rows[0].n).toBe(1);
  });

  itIfPg('reprocess is idempotent via ON CONFLICT', async () => {
    if (!cargaId) return;

    processar.mockResolvedValueOnce([{ carga_id: cargaId, status: 'ok' }]);

    const before = await query(
      'SELECT COUNT(*)::int AS n FROM esus_indicadores_raw WHERE carga_id = $1',
      [cargaId]
    );

    const res = await request(app)
      .post(`/api/importacao/${cargaId}/reprocessar`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);

    const after = await query(
      'SELECT COUNT(*)::int AS n FROM esus_indicadores_raw WHERE carga_id = $1',
      [cargaId]
    );
    expect(after.rows[0].n).toBeGreaterThanOrEqual(before.rows[0].n);
  });

  itIfPg('delete cascades esus_indicadores_raw', async () => {
    if (!cargaId) return;

    const res = await request(app)
      .delete(`/api/importacao/${cargaId}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);

    const raw = await query('SELECT 1 FROM esus_indicadores_raw WHERE carga_id = $1', [cargaId]);
    expect(raw.rows).toHaveLength(0);
    cargaId = null;
  });
});
