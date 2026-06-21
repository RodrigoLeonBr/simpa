import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPainelWidget,
  discoverPainelMetricas,
  fetchPainelLayout,
  fetchPainelMetrica,
  fetchPainelMetricas,
  fetchPainelWidget,
  fetchPainelWidgets,
  inactivatePainelWidget,
  previewPainelWidget,
  reorderPainelWidgets,
  updatePainelWidget,
} from './painelWidgets';
import { apiFetch } from './client';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

describe('painelWidgets api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchPainelLayout monta URL com competencia e estabelecimento opcional', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
      widgets: [],
    });

    await fetchPainelLayout({
      competencia: '2026-05',
      estabelecimentoId: 42,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/dashboard/painel-layout?competencia=2026-05&perfil=APS&layout=A&estabelecimento_id=42'
    );
  });

  it('createPainelWidget faz POST com body JSON', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: 1, slug: 'novo' });

    await createPainelWidget({
      slug: 'novo',
      perfil: 'APS',
      layout: 'A',
      tipo: 'card',
      titulo: 'Novo',
      metrica_id: 1,
    });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/cadastros/painel-widgets',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"slug":"novo"'),
      })
    );
  });

  it('discoverPainelMetricas faz POST no endpoint descobrir', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ inserted: 1, updated: 2 });
    await discoverPainelMetricas();
    expect(apiFetch).toHaveBeenCalledWith('/api/cadastros/painel-metricas/descobrir', {
      method: 'POST',
    });
  });

  it('cobre funções restantes de widget e catálogo', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce({ id: 10, status: 'inativo' })
      .mockResolvedValueOnce({ slug: 'x', tipo: 'card' })
      .mockResolvedValueOnce({ data: [], pagination: { page: 1, limit: 20, total: 0, pages: 1 } })
      .mockResolvedValueOnce({ id: 99, chave: 'x' });

    await fetchPainelWidgets({ perfil: 'APS', layout: 'A', includeInactive: true });
    await fetchPainelWidget(10);
    await updatePainelWidget(10, { titulo: 'Novo título' });
    await reorderPainelWidgets({ perfil: 'APS', layout: 'A', orderedIds: [3, 1, 2] });
    await inactivatePainelWidget(10);
    await previewPainelWidget({ widgetId: 10, scope: { competencia: '2026-05' } });
    await fetchPainelMetricas({ q: 'atendimento', fonte_tipo: 'esus_raw', page: 2, limit: 50 });
    await fetchPainelMetrica(99);

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/cadastros/painel-widgets?perfil=APS&layout=A&include_inactive=true'
    );
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/cadastros/painel-widgets/10');
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/cadastros/painel-widgets/10',
      expect.objectContaining({ method: 'PUT' })
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      4,
      '/api/cadastros/painel-widgets/reorder',
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      5,
      '/api/cadastros/painel-widgets/10',
      expect.objectContaining({ method: 'DELETE' })
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      6,
      '/api/cadastros/painel-widgets/preview',
      expect.objectContaining({ method: 'POST' })
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      7,
      '/api/cadastros/painel-metricas?q=atendimento&fonte_tipo=esus_raw&page=2&limit=50'
    );
    expect(apiFetch).toHaveBeenNthCalledWith(8, '/api/cadastros/painel-metricas/99');
  });
});
