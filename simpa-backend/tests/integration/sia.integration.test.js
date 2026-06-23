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
      await query("DELETE FROM sia_producao WHERE unidade = 'INTEGRATION-SIA-MISSING'");
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

  itIfPg('POST sincronizar mock path populates history and GET producao', async () => {
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
      await query(
        `INSERT INTO sia_producao (
           sincronizacao_id, competencia, unidade, codigo_sigtap, descricao,
           quantidade, valor_aprovado, faixa_etaria, sexo, cbo
         ) VALUES (
           $1, '2026-05-01', 'INTEGRATION-SIA', '0301010072', 'Consulta',
           7, 100.00, '20-29', 'F', '225125'
         )
         ON CONFLICT DO NOTHING`,
        [syncId]
      );
      return {
        sincronizacao_id: syncId,
        competencia: '2026-05-01',
        registros: 1,
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
    expect(res.body.registros).toBe(1);
    expect(res.body.competencia).toBe('2026-05-01');

    const { rows } = await query(
      "SELECT id, status, registros FROM sia_sincronizacoes WHERE competencia = '2026-05-01'"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ok');
    syncId = rows[0].id;

    const producaoRes = await request(app)
      .get('/api/sia/producao')
      .query({ competencia: '2026-05', unidade: 'INTEGRATION-SIA' })
      .set('Authorization', authHeader());

    expect(producaoRes.status).toBe(200);
    expect(producaoRes.body.length).toBeGreaterThan(0);
    expect(producaoRes.body[0]).toMatchObject({
      codigo_sigtap: '0301010072',
      quantidade: '7',
      valor_aprovado: '100.00',
    });
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
      `INSERT INTO formas_sia (codigo_grupo, codigo_subgrupo, codigo_forma, descricao, status)
       VALUES ('03', '0301', '030101', 'CONSULTA MEDICA', 'ativo')
       ON CONFLICT (codigo_forma) DO UPDATE SET descricao = EXCLUDED.descricao, status = 'ativo'`
    );
    await query(
      `INSERT INTO cbos_sia (codigo_cbo, descricao, status)
       VALUES ('225125', 'MEDICO CLINICO', 'ativo')
       ON CONFLICT (codigo_cbo) DO UPDATE SET descricao = EXCLUDED.descricao, status = 'ativo'`
    );

    await query(
      `INSERT INTO sia_producao (
         sincronizacao_id, competencia, unidade, codigo_sigtap, descricao,
         quantidade, valor_aprovado, faixa_etaria, sexo, cbo
       ) VALUES ($1, '2026-05-01', 'INTEGRATION-SIA', '0301010072', 'Consulta', 7, 100.00, '20-29', 'F', '225125')
       ON CONFLICT DO NOTHING`,
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
      descricao_forma: 'CONSULTA MEDICA',
      descricao_cbo: 'MEDICO CLINICO',
    });
  });

  itIfPg('GET producao keeps valid payload when cadastro is missing', async () => {
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
       ) VALUES ($1, '2026-05-01', 'INTEGRATION-SIA-MISSING', '9999999999', 'Sem cadastro', 3, 50.00, '30-39', 'M', '999999')
       ON CONFLICT DO NOTHING`,
      [syncId]
    );

    const res = await request(app)
      .get('/api/sia/producao')
      .query({ competencia: '2026-05', unidade: 'INTEGRATION-SIA-MISSING' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      codigo_sigtap: '9999999999',
      quantidade: '3',
      descricao_forma: null,
      descricao_cbo: null,
    });
  });
});
