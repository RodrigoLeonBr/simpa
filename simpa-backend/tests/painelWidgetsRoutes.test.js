jest.mock('../src/services/painelWidgetsService', () => ({
  listWidgets: jest.fn(),
  getWidgetById: jest.fn(),
  createWidget: jest.fn(),
  updateWidget: jest.fn(),
  reorderWidgets: jest.fn(),
  inactivateWidget: jest.fn(),
  previewWidget: jest.fn(),
}));

jest.mock('../src/services/auditService', () => ({
  logAudit: jest.fn(),
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const {
  listWidgets,
  getWidgetById,
  createWidget,
  updateWidget,
  reorderWidgets,
  inactivateWidget,
  previewWidget,
} = require('../src/services/painelWidgetsService');
const { logAudit } = require('../src/services/auditService');
const { authHeader, gestorHeader } = require('./helpers/auth');
const app = require('../src/app');

function visualizadorHeader() {
  process.env.JWT_SECRET =
    process.env.JWT_SECRET || 'test-secret-with-at-least-32-characters';
  const token = jwt.sign(
    {
      sub: 9,
      username: 'viewer',
      nome: 'Visualizador',
      perfil: 'Visualizador',
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `Bearer ${token}`;
}

describe('cadastros painel-widgets routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listWidgets.mockResolvedValue([
      { id: 1, slug: 'atendimentos', perfil: 'APS', layout: 'A', ordem: 1 },
    ]);
    getWidgetById.mockResolvedValue({ id: 1, slug: 'atendimentos' });
    createWidget.mockResolvedValue({ id: 2, slug: 'novo', perfil: 'APS', layout: 'A' });
    updateWidget.mockResolvedValue({ id: 2, slug: 'novo-edit', perfil: 'APS', layout: 'A' });
    reorderWidgets.mockResolvedValue([{ id: 2, ordem: 1 }]);
    inactivateWidget.mockResolvedValue({ id: 2, status: 'inativo' });
    previewWidget.mockResolvedValue({ slug: 'novo', tipo: 'card', valueLabel: '10' });
    logAudit.mockResolvedValue(undefined);
  });

  it('GET list retorna 200 para usuário autenticado', async () => {
    const res = await request(app)
      .get('/api/cadastros/painel-widgets')
      .query({ perfil: 'APS', layout: 'A' })
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(listWidgets).toHaveBeenCalledWith({
      perfil: 'APS',
      layout: 'A',
      includeInactive: false,
    });
  });

  it('GET detail retorna 200 para usuário autenticado', async () => {
    const res = await request(app)
      .get('/api/cadastros/painel-widgets/1')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(getWidgetById).toHaveBeenCalledWith('1');
  });

  it('GET list aceita include_inactive=true', async () => {
    await request(app)
      .get('/api/cadastros/painel-widgets')
      .query({ perfil: 'APS', layout: 'A', include_inactive: 'true' })
      .set('Authorization', authHeader());

    expect(listWidgets).toHaveBeenCalledWith({
      perfil: 'APS',
      layout: 'A',
      includeInactive: true,
    });
  });

  it('POST create retorna 403 para Visualizador', async () => {
    const res = await request(app)
      .post('/api/cadastros/painel-widgets')
      .set('Authorization', visualizadorHeader())
      .send({
        slug: 'novo',
        perfil: 'APS',
        layout: 'A',
        tipo: 'card',
        titulo: 'Novo',
        metrica_id: 1,
      });

    expect(res.status).toBe(403);
    expect(createWidget).not.toHaveBeenCalled();
  });

  it('POST create retorna 201 para Planejamento/Gestor Secretaria', async () => {
    const res = await request(app)
      .post('/api/cadastros/painel-widgets')
      .set('Authorization', gestorHeader())
      .send({
        slug: 'novo',
        perfil: 'APS',
        layout: 'A',
        tipo: 'card',
        titulo: 'Novo',
        metrica_id: 1,
      });

    expect(res.status).toBe(201);
    expect(createWidget).toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'painel_widget_create' })
    );
  });

  it('PUT update retorna 200 e escreve audit', async () => {
    const res = await request(app)
      .put('/api/cadastros/painel-widgets/2')
      .set('Authorization', authHeader())
      .send({ titulo: 'Novo título' });

    expect(res.status).toBe(200);
    expect(updateWidget).toHaveBeenCalledWith('2', { titulo: 'Novo título' });
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'painel_widget_update' })
    );
  });

  it('PUT update retorna 403 para Visualizador', async () => {
    const res = await request(app)
      .put('/api/cadastros/painel-widgets/2')
      .set('Authorization', visualizadorHeader())
      .send({ titulo: 'Novo título' });

    expect(res.status).toBe(403);
    expect(updateWidget).not.toHaveBeenCalled();
  });

  it('PATCH reorder com orderedIds inválido retorna 400', async () => {
    const res = await request(app)
      .patch('/api/cadastros/painel-widgets/reorder')
      .set('Authorization', authHeader())
      .send({ perfil: 'APS', layout: 'A', orderedIds: 'abc' });

    expect(res.status).toBe(400);
    expect(reorderWidgets).not.toHaveBeenCalled();
  });

  it('PATCH reorder válido retorna 200 e escreve audit', async () => {
    const res = await request(app)
      .patch('/api/cadastros/painel-widgets/reorder')
      .set('Authorization', authHeader())
      .send({ perfil: 'APS', layout: 'A', orderedIds: [2, 1] });

    expect(res.status).toBe(200);
    expect(reorderWidgets).toHaveBeenCalledWith('APS', 'A', [2, 1]);
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'painel_widget_reorder' })
    );
  });

  it('POST preview retorna fragmento resolvido', async () => {
    const res = await request(app)
      .post('/api/cadastros/painel-widgets/preview')
      .set('Authorization', authHeader())
      .send({
        widget: {
          tipo: 'card',
          titulo: 'Preview',
          metrica_id: 1,
        },
        scope: { competencia: '2026-05' },
      });

    expect(res.status).toBe(200);
    expect(res.body.valueLabel).toBe('10');
    expect(previewWidget).toHaveBeenCalled();
  });

  it('POST preview aceita widgetId', async () => {
    const res = await request(app)
      .post('/api/cadastros/painel-widgets/preview')
      .set('Authorization', authHeader())
      .send({
        widgetId: 1,
        scope: { competencia: '2026-05' },
      });

    expect(res.status).toBe(200);
    expect(previewWidget).toHaveBeenCalledWith(1, { competencia: '2026-05' });
  });

  it('POST preview prioriza body.widget sobre widgetId (rascunho da tela)', async () => {
    const draft = {
      tipo: 'card',
      titulo: 'Rascunho não salvo',
      metrica_id: 99,
      sql_override: 'SELECT 42 AS valor',
      formato: 'numero',
    };

    const res = await request(app)
      .post('/api/cadastros/painel-widgets/preview')
      .set('Authorization', authHeader())
      .send({
        widgetId: 1,
        widget: draft,
        scope: { competencia: '2026-05' },
      });

    expect(res.status).toBe(200);
    expect(previewWidget).toHaveBeenCalledWith(draft, { competencia: '2026-05' });
    expect(previewWidget).not.toHaveBeenCalledWith(1, expect.anything());
  });

  it('DELETE inativa e escreve audit', async () => {
    const res = await request(app)
      .delete('/api/cadastros/painel-widgets/2')
      .set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inativo');
    expect(inactivateWidget).toHaveBeenCalledWith('2');
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ acao: 'painel_widget_inactivate' })
    );
  });

  it('DELETE retorna 403 para Visualizador', async () => {
    const res = await request(app)
      .delete('/api/cadastros/painel-widgets/2')
      .set('Authorization', visualizadorHeader());

    expect(res.status).toBe(403);
    expect(inactivateWidget).not.toHaveBeenCalled();
  });

  it('propaga erro de serviço no GET detail', async () => {
    const err = new Error('Widget não encontrado');
    err.status = 404;
    getWidgetById.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/painel-widgets/999')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('propaga erro no GET list', async () => {
    const err = new Error('list failed');
    err.status = 500;
    listWidgets.mockRejectedValueOnce(err);

    const res = await request(app)
      .get('/api/cadastros/painel-widgets')
      .set('Authorization', authHeader());

    expect(res.status).toBe(500);
  });

  it('propaga erro no POST create', async () => {
    const err = new Error('create failed');
    err.status = 400;
    createWidget.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/cadastros/painel-widgets')
      .set('Authorization', authHeader())
      .send({
        slug: 'x',
        perfil: 'APS',
        layout: 'A',
        tipo: 'card',
        titulo: 'x',
      });

    expect(res.status).toBe(400);
  });

  it('propaga erro no PUT update', async () => {
    const err = new Error('update failed');
    err.status = 404;
    updateWidget.mockRejectedValueOnce(err);

    const res = await request(app)
      .put('/api/cadastros/painel-widgets/2')
      .set('Authorization', authHeader())
      .send({ titulo: 'x' });

    expect(res.status).toBe(404);
  });

  it('propaga erro no PATCH reorder', async () => {
    const err = new Error('reorder failed');
    err.status = 400;
    reorderWidgets.mockRejectedValueOnce(err);

    const res = await request(app)
      .patch('/api/cadastros/painel-widgets/reorder')
      .set('Authorization', authHeader())
      .send({ perfil: 'APS', layout: 'A', orderedIds: [1, 2] });

    expect(res.status).toBe(400);
  });

  it('propaga erro no DELETE', async () => {
    const err = new Error('delete failed');
    err.status = 404;
    inactivateWidget.mockRejectedValueOnce(err);

    const res = await request(app)
      .delete('/api/cadastros/painel-widgets/2')
      .set('Authorization', authHeader());

    expect(res.status).toBe(404);
  });

  it('propaga erro no POST preview', async () => {
    const err = new Error('preview failed');
    err.status = 400;
    previewWidget.mockRejectedValueOnce(err);

    const res = await request(app)
      .post('/api/cadastros/painel-widgets/preview')
      .set('Authorization', authHeader())
      .send({ widgetId: 1, scope: { competencia: '2026-05' } });

    expect(res.status).toBe(400);
  });
});
