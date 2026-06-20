jest.mock('../src/services/db');
jest.mock('../src/services/estabelecimentosService');
jest.mock('../src/services/procedimentosService');
jest.mock('../src/services/auditService');

const request = require('supertest');
const {
  listEstabelecimentos,
  getEstabelecimentoById,
  updatePerfil,
  upsertEnrichment,
  updateEnriquecimento,
} = require('../src/services/estabelecimentosService');
const { listProcedimentos } = require('../src/services/procedimentosService');
const { logAudit } = require('../src/services/auditService');
const { authHeader, unidadeHeader } = require('./helpers/auth');
const app = require('../src/app');

describe('estabelecimentos and procedimentos routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    logAudit.mockResolvedValue(undefined);
    listEstabelecimentos.mockResolvedValue({
      data: [
        {
          id: 1,
          codigo_externo: '1234567',
          nome: 'UBS Centro',
          perfil: 'APS',
          status: 'ativo',
          enrichment: {},
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    });
    getEstabelecimentoById.mockResolvedValue({
      id: 1,
      codigo_externo: '1234567',
      nome: 'UBS Centro',
      perfil: 'APS',
      perfil_editado: true,
      enrichment: {},
    });
    updatePerfil.mockResolvedValue({
      id: 1,
      perfil: 'APS',
      perfil_editado: true,
      enrichment: {},
    });
    upsertEnrichment.mockResolvedValue({
      id: 1,
      perfil: 'APS',
      enrichment: { notas: 'ok' },
    });
    updateEnriquecimento.mockResolvedValue({
      id: 1,
      perfil: 'Hospitalar',
      enrichment: { leitos: { clinico: 10 } },
    });
    listProcedimentos.mockResolvedValue({
      data: [{ id: 2, codigo_sigtap: '0301010010', descricao: 'CONSULTA' }],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    });
  });

  it('GET /estabelecimentos supports perfil filter', async () => {
    const res = await request(app)
      .get('/api/cadastros/estabelecimentos')
      .query({ perfil: 'Hospitalar' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(listEstabelecimentos).toHaveBeenCalledWith(
      expect.objectContaining({ perfil: 'Hospitalar' })
    );
  });

  it('PUT /estabelecimentos/:id/perfil returns 200 for planning staff', async () => {
    const res = await request(app)
      .put('/api/cadastros/estabelecimentos/1/perfil')
      .set('Authorization', authHeader())
      .send({ perfil: 'APS' });

    expect(res.status).toBe(200);
    expect(res.body.perfil_editado).toBe(true);
    expect(updatePerfil).toHaveBeenCalledWith('1', 'APS');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'estabelecimento_perfil_update',
        recurso: 'estabelecimentos',
      })
    );
  });

  it('PUT /estabelecimentos/:id/perfil returns 403 for read-only user', async () => {
    const res = await request(app)
      .put('/api/cadastros/estabelecimentos/1/perfil')
      .set('Authorization', unidadeHeader())
      .send({ perfil: 'APS' });

    expect(res.status).toBe(403);
    expect(updatePerfil).not.toHaveBeenCalled();
  });

  it('PUT /estabelecimentos/:id/enriquecimento/:slug returns 403 on slug/perfil mismatch', async () => {
    upsertEnrichment.mockRejectedValueOnce(
      Object.assign(new Error('Slug de enriquecimento não corresponde ao perfil do estabelecimento'), {
        status: 403,
      })
    );

    const res = await request(app)
      .put('/api/cadastros/estabelecimentos/1/enriquecimento/aps')
      .set('Authorization', authHeader())
      .send({ notas: 'x' });

    expect(res.status).toBe(403);
  });

  it('PUT /estabelecimentos/:id/enriquecimento/:slug logs audit on success', async () => {
    const res = await request(app)
      .put('/api/cadastros/estabelecimentos/1/enriquecimento/aps')
      .set('Authorization', authHeader())
      .send({ notas: 'ok' });

    expect(res.status).toBe(200);
    expect(upsertEnrichment).toHaveBeenCalledWith('1', 'aps', { notas: 'ok' });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'estabelecimento_enriquecimento_update',
      })
    );
  });

  it('PUT /estabelecimentos/:id/enriquecimento proxies legacy path to service', async () => {
    const res = await request(app)
      .put('/api/cadastros/estabelecimentos/1/enriquecimento')
      .set('Authorization', authHeader())
      .send({ leitos: { clinico: 10 } });

    expect(res.status).toBe(200);
    expect(updateEnriquecimento).toHaveBeenCalledWith('1', {
      leitos: { clinico: 10 },
    });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        acao: 'estabelecimento_enriquecimento_update',
        detalhes: expect.stringContaining('legacy'),
      })
    );
  });

  it('PUT /estabelecimentos/:id/enriquecimento returns 403 for read-only user', async () => {
    const res = await request(app)
      .put('/api/cadastros/estabelecimentos/1/enriquecimento')
      .set('Authorization', unidadeHeader())
      .send({ leitos: { clinico: 10 } });

    expect(res.status).toBe(403);
    expect(updateEnriquecimento).not.toHaveBeenCalled();
  });

  it('GET /procedimentos returns paginated list', async () => {
    const res = await request(app)
      .get('/api/cadastros/procedimentos')
      .query({ q: 'CONSULTA' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(listProcedimentos).toHaveBeenCalled();
  });

  it('POST /procedimentos returns 405', async () => {
    const res = await request(app)
      .post('/api/cadastros/procedimentos')
      .set('Authorization', authHeader())
      .send({ codigo_sigtap: '0301010010' });

    expect(res.status).toBe(405);
    expect(res.body.error).toMatch(/somente leitura/i);
  });

  it('requires JWT', async () => {
    const res = await request(app).get('/api/cadastros/estabelecimentos');
    expect(res.status).toBe(401);
  });
});
