jest.mock('../../src/services/sia');
jest.mock('../../src/services/consolidator', () => ({
  runConsolidation: jest.fn().mockResolvedValue({ ok: true, result: { status: 'ok' } }),
}));

const request = require('supertest');
const { query } = require('../../src/services/db');
const { sincronizar } = require('../../src/services/sia');
const { authHeader } = require('../helpers/auth');
const app = require('../../src/app');

const hasPg =
  process.env.PG_HOST &&
  process.env.PG_DB &&
  process.env.PG_USER &&
  process.env.PG_PASS;

const describeIfPg = hasPg ? describe : describe.skip;

let pgReady = false;
let syncId = null;

function itIfPg(name, fn) {
  it(name, async () => {
    if (!pgReady) return;
    await fn();
  });
}

describeIfPg('sia integration', () => {
  beforeAll(async () => {
    try {
      await query('SELECT 1');
      await query("DELETE FROM sia_producao WHERE unidade = 'INTEGRATION-SIA'");
      await query(
        "DELETE FROM sia_sincronizacoes WHERE competencia = '2026-05-01'"
      );
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  afterAll(async () => {
    if (!pgReady) return;
    if (syncId) {
      await query('DELETE FROM sia_producao WHERE sincronizacao_id = $1', [syncId]);
      await query('DELETE FROM sia_sincronizacoes WHERE id = $1', [syncId]);
    }
  });

  itIfPg('POST sincronizar records row in sia_sincronizacoes', async () => {
    sincronizar.mockImplementationOnce(async () => {
      const insert = await query(
        `INSERT INTO sia_sincronizacoes (competencia, status, registros, erros)
         VALUES ('2026-05-01', 'ok', 2, 0)
         ON CONFLICT (competencia) DO UPDATE SET
           status = 'ok',
           registros = 2,
           erros = 0,
           sincronizado_em = now()
         RETURNING id, competencia, status, registros, erros`,
        []
      );
      syncId = insert.rows[0].id;
      return {
        sincronizacao_id: syncId,
        competencia: '2026-05-01',
        registros: 2,
        erros: 0,
        status: 'ok',
      };
    });

    const res = await request(app)
      .post('/api/sia/sincronizar')
      .set('Authorization', authHeader())
      .send({ competencia: '2026-05' });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ok');

    const { rows } = await query(
      "SELECT id, status, registros FROM sia_sincronizacoes WHERE competencia = '2026-05-01'"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ok');
    syncId = rows[0].id;
  });

  itIfPg('GET producao returns filtered rows from seed', async () => {
    if (!syncId) {
      const insert = await query(
        `INSERT INTO sia_sincronizacoes (competencia, status, registros, erros)
         VALUES ('2026-05-01', 'ok', 1, 0)
         ON CONFLICT (competencia) DO UPDATE SET status = 'ok'
         RETURNING id`
      );
      syncId = insert.rows[0].id;
    }

    await query(
      `INSERT INTO sia_producao (
         sincronizacao_id, competencia, unidade, codigo_sigtap, descricao,
         quantidade, valor_aprovado, faixa_etaria, sexo, cbo
       ) VALUES ($1, '2026-05-01', 'INTEGRATION-SIA', '0301010072', 'Consulta', 7, 100.00, '20-29', 'F', '225125')
       ON CONFLICT (sincronizacao_id, unidade, codigo_sigtap, faixa_etaria, sexo, cbo)
       DO UPDATE SET quantidade = EXCLUDED.quantidade`,
      [syncId]
    );

    const res = await request(app)
      .get('/api/sia/producao')
      .query({ competencia: '2026-05', unidade: 'INTEGRATION-SIA' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      codigo_sigtap: '0301010072',
      quantidade: '7',
    });
  });
});
