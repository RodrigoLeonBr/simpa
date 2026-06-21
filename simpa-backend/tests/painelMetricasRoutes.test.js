jest.mock('../src/services/painelMetricsService', () => ({
  listMetricas: jest.fn(),
  getMetricaById: jest.fn(),
  discoverMetricsFromRaw: jest.fn(),
}));

jest.mock('../src/services/auditService', () => ({
  logAudit: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const {
  listMetricas,
  getMetricaById,
  discoverMetricsFromRaw,
} = require('../src/services/painelMetricsService');
const { logAudit } = require('../src/services/auditService');
const { authHeader, gestorHeader } = require('./helpers/auth');
const app = require('../src/app');

function visualizadorHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    { sub: 8, username: 'vis', nome: 'Vis', perfil: 'Visualizador' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

describe('cadastros painel-metricas routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listMetricas.mockResolvedValue({
      data: [{ id: 1, label: 'Atendimento', chave: 'esus.atendimento' }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    getMetricaById.mockResolvedValue({ id: 1, chave: 'esus.atendimento', sql_template: 'SELECT 1' });
    discoverMetricsFromRaw.mockResolvedValue({ inserted: 1, updated: 2 });
    logAudit.mockResolvedValue(undefined);
  });

  it('GET list com q filtra resultados', async () => {
    const res = await request(app)
      .get('/api/cadastros/painel-metricas')
      .query({ q: 'atendimento', fonte_tipo: 'esus_raw' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(listMetricas).toHaveBeenCalledWith({
      q: 'atendimento',
      fonte_tipo: 'esus_raw',
      page: undefined,
      limit: undefined,
    });
    expect(res.body.data).toHaveLength(1);
  });

  it('GET :id retorna 404 quando métrica não existe', async () => {
    const err = new Error('Métrica não encontrada');
    err.status = 404;
    getMetricaById.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/painel-metricas/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('POST descobrir retorna 403 para usuário não planning', async () => {
    const res = await request(app)
      .post('/api/cadastros/painel-metricas/descobrir')
      .set('Authorization', visualizadorHeader());

    expect(res.status).toBe(403);
    expect(discoverMetricsFromRaw).not.toHaveBeenCalled();
  });

  it('POST descobrir retorna payload inserted/updated e audit', async () => {
    const res = await request(app)
      .post('/api/cadastros/painel-metricas/descobrir')
      .set('Authorization', gestorHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ inserted: 1, updated: 2 });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'painel_metricas_descobrir' })
    );
  });
});
