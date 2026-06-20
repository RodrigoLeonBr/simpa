const fs = require('fs');
const path = require('path');
const Ajv2020 = require('ajv/dist/2020');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../../src/services/db');
const { samplePayload } = require('../fixtures/sampleContrato');
const app = require('../../src/app');

const hasPg =
  process.env.PG_HOST &&
  process.env.PG_DB &&
  process.env.PG_USER &&
  process.env.PG_PASS;

const describeIfPg = hasPg ? describe : describe.skip;

const schemaPath = path.join(
  __dirname,
  '../../../tests/fixtures/contrato_v3_1_0.schema.json'
);
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validateContrato = ajv.compile(schema);

let pgReady = false;

function authHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'integration-test-secret-min-32-chars';
  const token = jwt.sign(
    { sub: 1, username: 'admin', nome: 'Admin', perfil: 'Administrador' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

function itIfPg(name, fn) {
  it(name, async () => {
    if (!pgReady) return;
    await fn();
  });
}

describeIfPg('dashboard integration', () => {
  beforeAll(async () => {
    try {
      await query('SELECT 1');
      await query(
        `INSERT INTO dados_consolidados (
           competencia, municipio, unidade, equipe, versao_schema, dados_conteudo
         ) VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (competencia, unidade, equipe) DO UPDATE SET
           dados_conteudo = EXCLUDED.dados_conteudo,
           versao_schema = EXCLUDED.versao_schema,
           atualizado_em = now()`,
        [
          '2026-05-01',
          'AMERICANA',
          samplePayload.filtros_ativos.unidade,
          samplePayload.filtros_ativos.equipe,
          '3.1.0',
          samplePayload,
        ]
      );
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  itIfPg('GET dashboard with seed-like payload matches JSON schema', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/planejamento')
      .query({
        competencia: '2026-05',
        unidade: samplePayload.filtros_ativos.unidade,
        equipe: samplePayload.filtros_ativos.equipe,
      })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(validateContrato(res.body)).toBe(true);
    expect(res.body.indicadores_qualidade.length).toBeGreaterThan(0);
  });

  itIfPg('GET dashboard returns 404 for unknown filters', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard/planejamento')
      .query({
        competencia: '2026-05',
        unidade: 'UNIDADE INEXISTENTE',
        equipe: 'EQUIPE INEXISTENTE',
      })
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });
});
