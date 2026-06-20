const request = require('supertest');
const jwt = require('jsonwebtoken');
const { query } = require('../../src/services/db');
const {
  upsertEnrichment,
  getEstabelecimentoById,
} = require('../../src/services/estabelecimentosService');
const { authHeader, unidadeHeader } = require('../helpers/auth');
const app = require('../../src/app');

const hasPg =
  process.env.PG_HOST &&
  process.env.PG_DB &&
  process.env.PG_USER &&
  process.env.PG_PASS;

const describeIfPg = hasPg ? describe : describe.skip;

let pgReady = false;
let estabelecimentoId = null;
let equipeId = null;

function itIfPg(name, fn) {
  it(name, async () => {
    if (!pgReady) return;
    await fn();
  });
}

function gestorHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    {
      sub: 99,
      username: 'gestor-int',
      nome: 'Gestor Int',
      perfil: 'Gestor Secretaria',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

describeIfPg('cadastros integration', () => {
  beforeAll(async () => {
    try {
      await query('SELECT 1');
      await query(
        `DELETE FROM equipes WHERE codigo IN ('INT-EQ-06', 'INT-EQ-05')
         OR estabelecimento_id IN (
           SELECT id FROM estabelecimentos
           WHERE codigo_externo IN ('INT-EST-05', 'INT-EQ-06', 'INT-SHIM-06', 'INT-RT-04')
         )`
      );
      await query(
        `DELETE FROM enriquecimento_aps
         WHERE estabelecimento_id IN (
           SELECT id FROM estabelecimentos
           WHERE codigo_externo IN ('INT-EST-05', 'INT-RT-04')
         )`
      );
      await query(
        `DELETE FROM enriquecimento_hospitalar
         WHERE estabelecimento_id IN (
           SELECT id FROM estabelecimentos
           WHERE codigo_externo IN ('INT-EST-05', 'INT-RT-04', 'INT-SVC-03')
         )`
      );
      await query(
        `DELETE FROM estabelecimentos
         WHERE codigo_externo IN ('INT-EST-05', 'INT-EQ-06', 'INT-SHIM-06', 'INT-RT-04', 'INT-SVC-03', 'INT-APS-ENR')`
      );
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  afterAll(async () => {
    if (!pgReady) return;
    if (estabelecimentoId) {
      await query('DELETE FROM enriquecimento_hospitalar WHERE estabelecimento_id = $1', [
        estabelecimentoId,
      ]);
      await query('DELETE FROM equipes WHERE estabelecimento_id = $1', [
        estabelecimentoId,
      ]);
      await query('DELETE FROM estabelecimentos WHERE id = $1', [estabelecimentoId]);
    }
  });

  itIfPg('full round-trip PUT perfil then PUT enrichment aps then GET detail', async () => {
    const insert = await query(
      `INSERT INTO estabelecimentos (
         codigo_externo, nome, perfil, status, enriquecimento
       ) VALUES (
         'INT-RT-04', 'Unidade Round Trip Task 04', 'Outro', 'ativo', '{}'::jsonb
       ) RETURNING id`
    );
    const roundTripId = insert.rows[0].id;

    try {
      const perfilRes = await request(app)
        .put(`/api/cadastros/estabelecimentos/${roundTripId}/perfil`)
        .set('Authorization', authHeader())
        .send({ perfil: 'APS' });

      expect(perfilRes.status).toBe(200);
      expect(perfilRes.body.perfil).toBe('APS');
      expect(perfilRes.body.perfil_editado).toBe(true);

      const enrichRes = await request(app)
        .put(`/api/cadastros/estabelecimentos/${roundTripId}/enriquecimento/aps`)
        .set('Authorization', authHeader())
        .send({ notas_territorio: 'Território integração', notas: 'APS ok' });

      expect(enrichRes.status).toBe(200);
      expect(enrichRes.body.enrichment.notas_territorio).toBe('Território integração');

      const detail = await request(app)
        .get(`/api/cadastros/estabelecimentos/${roundTripId}`)
        .set('Authorization', authHeader());

      expect(detail.status).toBe(200);
      expect(detail.body.perfil).toBe('APS');
      expect(detail.body.perfil_editado).toBe(true);
      expect(detail.body.enrichment.notas).toBe('APS ok');

      const audit = await query(
        `SELECT acao, detalhes
         FROM audit_log
         WHERE acao = 'estabelecimento_perfil_update'
           AND detalhes->>'estabelecimento_id' = $1
         ORDER BY id DESC
         LIMIT 1`,
        [String(roundTripId)]
      );

      expect(audit.rows.length).toBe(1);
      expect(audit.rows[0].detalhes.perfil).toBe('APS');
    } finally {
      await query('DELETE FROM enriquecimento_aps WHERE estabelecimento_id = $1', [
        roundTripId,
      ]);
      await query('DELETE FROM enriquecimento_outro WHERE estabelecimento_id = $1', [
        roundTripId,
      ]);
      await query('DELETE FROM estabelecimentos WHERE id = $1', [roundTripId]);
    }
  });

  itIfPg('PUT perfil returns 403 for non-planning role', async () => {
    const insert = await query(
      `INSERT INTO estabelecimentos (
         codigo_externo, nome, perfil, status, enriquecimento
       ) VALUES (
         'INT-NP-04', 'Unidade Sem Permissão', 'Outro', 'ativo', '{}'::jsonb
       ) RETURNING id`
    );
    const estabId = insert.rows[0].id;

    try {
      const res = await request(app)
        .put(`/api/cadastros/estabelecimentos/${estabId}/perfil`)
        .set('Authorization', unidadeHeader())
        .send({ perfil: 'APS' });

      expect(res.status).toBe(403);
    } finally {
      await query('DELETE FROM estabelecimentos WHERE id = $1', [estabId]);
    }
  });

  itIfPg('service round-trip upsert hospitalar then GET detail', async () => {
    const insert = await query(
      `INSERT INTO estabelecimentos (
         codigo_externo, nome, perfil, status, enriquecimento
       ) VALUES (
         'INT-SVC-03', 'Hospital Service Task 03', 'Hospitalar', 'ativo', '{}'::jsonb
       ) RETURNING id`
    );
    const serviceEstabId = insert.rows[0].id;

    try {
      const updated = await upsertEnrichment(serviceEstabId, 'hospitalar', {
        leitos: { clinico: 12 },
        notas: 'via service',
      });

      expect(updated.enrichment.leitos.clinico).toBe(12);

      const detail = await getEstabelecimentoById(serviceEstabId);
      expect(detail.enrichment.leitos.clinico).toBe(12);
      expect(detail.perfil_editado).toBe(false);
    } finally {
      await query('DELETE FROM enriquecimento_hospitalar WHERE estabelecimento_id = $1', [
        serviceEstabId,
      ]);
      await query('DELETE FROM estabelecimentos WHERE id = $1', [serviceEstabId]);
    }
  });

  itIfPg('estabelecimentos list/detail/enriquecimento round-trip', async () => {
    const insert = await query(
      `INSERT INTO estabelecimentos (
         codigo_externo, nome, perfil, status, enriquecimento
       ) VALUES (
         'INT-EST-05', 'Hospital Integração Task 05', 'Hospitalar', 'ativo', '{}'::jsonb
       ) RETURNING id`
    );
    estabelecimentoId = insert.rows[0].id;

    const list = await request(app)
      .get('/api/cadastros/estabelecimentos')
      .query({ perfil: 'Hospitalar', q: 'INT-EST' })
      .set('Authorization', authHeader());

    expect(list.status).toBe(200);
    expect(list.body.data.some((row) => row.id === estabelecimentoId)).toBe(true);

    const detail = await request(app)
      .get(`/api/cadastros/estabelecimentos/${estabelecimentoId}`)
      .set('Authorization', authHeader());

    expect(detail.status).toBe(200);
    expect(detail.body.codigo_externo).toBe('INT-EST-05');

    const enrich = await request(app)
      .put(`/api/cadastros/estabelecimentos/${estabelecimentoId}/enriquecimento`)
      .set('Authorization', authHeader())
      .send({ leitos: { clinico: 10 }, notas: 'teste integração' });

    expect(enrich.status).toBe(200);
    expect(enrich.body.enrichment.leitos.clinico).toBe(10);

    const rejectHack = await request(app)
      .put(`/api/cadastros/estabelecimentos/${estabelecimentoId}/enriquecimento`)
      .set('Authorization', authHeader())
      .send({ nome: 'hack' });

    expect(rejectHack.status).toBe(400);
  });

  itIfPg('rejects enrichment for APS establishments', async () => {
    const insert = await query(
      `INSERT INTO estabelecimentos (
         codigo_externo, nome, perfil, status, enriquecimento
       ) VALUES (
         'INT-APS-ENR', 'UBS Integração APS', 'APS', 'ativo', '{}'::jsonb
       ) RETURNING id`
    );
    const apsId = insert.rows[0].id;

    const res = await request(app)
      .put(`/api/cadastros/estabelecimentos/${apsId}/enriquecimento`)
      .set('Authorization', authHeader())
      .send({ notas: 'não permitido' });

    expect(res.status).toBe(403);

    await query('DELETE FROM estabelecimentos WHERE id = $1', [apsId]);
  });

  itIfPg('POST /procedimentos returns 405', async () => {
    const res = await request(app)
      .post('/api/cadastros/procedimentos')
      .set('Authorization', authHeader())
      .send({ codigo_sigtap: '0301010010', descricao: 'X' });

    expect(res.status).toBe(405);
  });

  itIfPg('equipes CRUD round-trip linked to estabelecimento', async () => {
    expect(estabelecimentoId).toBeTruthy();

    const create = await request(app)
      .post('/api/cadastros/equipes')
      .set('Authorization', authHeader())
      .send({
        codigo: 'INT-EQ-06',
        nome: 'Equipe Integração 06',
        tipo: 'ESF',
        estabelecimento_id: estabelecimentoId,
      });

    expect(create.status).toBe(201);
    equipeId = create.body.id;

    const list = await request(app)
      .get('/api/cadastros/equipes')
      .query({ unidade_id: estabelecimentoId })
      .set('Authorization', authHeader());

    expect(list.status).toBe(200);
    expect(list.body.some((row) => row.id === equipeId)).toBe(true);
    expect(list.body.find((row) => row.id === equipeId).unidade_nome).toBe(
      'Hospital Integração Task 05'
    );

    const inactivate = await request(app)
      .delete(`/api/cadastros/equipes/${equipeId}`)
      .set('Authorization', authHeader());

    expect(inactivate.status).toBe(200);
    equipeId = null;
  });

  itIfPg('legacy entity routes return 404', async () => {
    const res = await request(app)
      .get('/api/cadastros/unidades')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  itIfPg('GET /estabelecimentos?perfil=Hospitalar lists synced establishments', async () => {
    expect(estabelecimentoId).toBeTruthy();

    const res = await request(app)
      .get('/api/cadastros/estabelecimentos')
      .query({ perfil: 'Hospitalar' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((row) => row.codigo_externo === 'INT-EST-05')).toBe(true);
  });
});

describeIfPg('admin integration', () => {
  beforeAll(async () => {
    try {
      await query('SELECT 1');
      pgReady = true;
    } catch (_err) {
      pgReady = false;
    }
  });

  itIfPg('non-admin cannot DELETE usuarios', async () => {
    const res = await request(app)
      .delete('/api/admin/usuarios/1')
      .set('Authorization', gestorHeader());

    expect(res.status).toBe(403);
  });
});
