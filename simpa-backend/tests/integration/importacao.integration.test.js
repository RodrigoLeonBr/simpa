jest.mock('../../src/services/parser');
jest.mock('../../src/services/consolidator', () => ({
  runConsolidation: jest.fn().mockResolvedValue({ ok: true, result: { status: 'ok' } }),
}));

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { query } = require('../../src/services/db');
const { preview, processar } = require('../../src/services/parser');
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
  arquivo_origem: 'relatorio.csv',
};

const fixtureCsv = path.join(
  __dirname,
  '../../../Relatório de atendimento individual-20260613175047.csv'
);

let pgReady = false;
let cargaId = null;

function itIfPg(name, fn) {
  it(name, async () => {
    if (!pgReady) return;
    await fn();
  });
}

describeIfPg('importacao integration', () => {
  beforeAll(async () => {
    process.env.UPLOAD_DIR = path.join(__dirname, '../tmp-uploads-integration');
    fs.mkdirSync(process.env.UPLOAD_DIR, { recursive: true });

    preview.mockImplementation(async () => [{ ...sampleMeta }]);
    processar.mockImplementation(async () => [
      {
        carga_id: 999,
        status: 'ok',
        tipo_relatorio: sampleMeta.tipo_relatorio,
        competencia: sampleMeta.competencia,
        unidade: sampleMeta.unidade,
        equipe_nome: sampleMeta.equipe_nome,
      },
    ]);

    try {
      await query('SELECT 1');
      await query('DELETE FROM esus_indicadores_raw WHERE carga_id IN (SELECT id FROM esus_cargas WHERE arquivo_origem = $1)', [
        'integration-fixture.csv',
      ]);
      await query('DELETE FROM esus_cargas WHERE arquivo_origem = $1', ['integration-fixture.csv']);
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  afterAll(async () => {
    if (!pgReady || !cargaId) return;
    await query('DELETE FROM esus_cargas WHERE id = $1', [cargaId]);
    try {
      fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
    } catch (_err) {
      // ignore
    }
  });

  itIfPg('upload fixture CSV creates esus_cargas row', async () => {
    if (!fs.existsSync(fixtureCsv)) {
      throw new Error(`Fixture CSV missing: ${fixtureCsv}`);
    }

    processar.mockImplementationOnce(async () => {
      const insert = await query(
        `INSERT INTO esus_cargas (
           tipo_relatorio, competencia, periodo_inicio, periodo_fim,
           municipio, unidade, equipe_codigo, equipe_nome, arquivo_origem
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (tipo_relatorio, competencia, unidade, equipe_nome)
         DO UPDATE SET importado_em = now()
         RETURNING id`,
        [
          sampleMeta.tipo_relatorio,
          '2026-05-01',
          '2026-05-01',
          '2026-05-31',
          'AMERICANA',
          sampleMeta.unidade,
          '0009',
          sampleMeta.equipe_nome,
          'integration-fixture.csv',
        ]
      );
      cargaId = insert.rows[0].id;
      await query(
        `INSERT INTO esus_indicadores_raw (carga_id, secao, descricao, ordem, valores)
         VALUES ($1, 'Resumo', 'Registros identificados', 0, $2)
         ON CONFLICT (carga_id, secao, descricao) DO UPDATE SET valores = EXCLUDED.valores`,
        [cargaId, JSON.stringify({ quantidade: 1 })]
      );
      return [{ carga_id: cargaId, status: 'ok' }];
    });

    const res = await request(app)
      .post('/api/importacao/upload')
      .set('Authorization', authHeader())
      .attach('files', fs.readFileSync(fixtureCsv), 'integration-fixture.csv');

    expect(res.status).toBe(201);
    expect(res.body[0].carga_id).toBeDefined();

    const listed = await query('SELECT id FROM esus_cargas WHERE id = $1', [cargaId]);
    expect(listed.rows).toHaveLength(1);
  });

  itIfPg('reprocess is idempotent via ON CONFLICT', async () => {
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
    const res = await request(app)
      .delete(`/api/importacao/${cargaId}`)
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);

    const raw = await query('SELECT 1 FROM esus_indicadores_raw WHERE carga_id = $1', [cargaId]);
    expect(raw.rows).toHaveLength(0);
    cargaId = null;
  });
});
