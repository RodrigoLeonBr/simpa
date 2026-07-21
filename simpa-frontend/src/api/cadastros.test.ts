import { describe, expect, it, vi } from 'vitest';
import {
  createCadastro,
  createLeitosVigencia,
  deleteLeitosVigencia,
  fetchCadastroList,
  fetchEquipes,
  fetchEstabelecimentosAps,
  fetchLeitosVigencias,
  fetchUltimaCadastroSync,
  inactivateCadastro,
  sincronizarCadastros,
  updateCadastro,
  updateEnrichmentBySlug,
  updateLeitosVigencia,
  updatePerfil,
} from './cadastros';
import { apiFetch } from './client';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

describe('cadastros api', () => {
  it('calls CRUD endpoints for cadastro resources', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce([{ id: 1 }])
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce({ id: 2, nome: 'Atualizado' })
      .mockResolvedValueOnce({ inativado: true, id: 2 });

    await fetchCadastroList('emendas');
    await createCadastro('emendas', { id_emenda: 'E1' });
    await updateCadastro('emendas', 2, { autor: 'Atualizado' });
    await inactivateCadastro('emendas', 2);

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/cadastros/emendas');
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      '/api/cadastros/emendas',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/cadastros/emendas/2',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      4,
      '/api/cadastros/emendas/2',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('passes estabelecimento filter to equipes list', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([]);
    await fetchEquipes(3);
    expect(apiFetch).toHaveBeenCalledWith('/api/cadastros/equipes?estabelecimento_id=3');
  });

  it('loads APS estabelecimentos for filters', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      data: [
        {
          id: 1,
          codigo_externo: 'A',
          nome: 'A',
          perfil: 'APS',
          perfil_editado: false,
          status: 'ativo',
        },
      ],
      pagination: { page: 1, limit: 200, total: 1, pages: 1 },
    });
    const rows = await fetchEstabelecimentosAps();
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/cadastros/estabelecimentos?perfil=APS&limit=200',
    );
    expect(rows).toHaveLength(1);
  });

  it('updatePerfil calls PUT perfil endpoint with JSON body', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      id: 1,
      perfil: 'APS',
      perfil_editado: true,
    });

    await updatePerfil(1, 'APS');

    expect(apiFetch).toHaveBeenCalledWith('/api/cadastros/estabelecimentos/1/perfil', {
      method: 'PUT',
      body: JSON.stringify({ perfil: 'APS' }),
    });
  });

  it('updateEnrichmentBySlug encodes slug in path segment', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      id: 1,
      perfil: 'APS',
      perfil_editado: true,
      enrichment: { notas: 'ok' },
    });

    await updateEnrichmentBySlug(1, 'aps', { notas: 'ok' });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/cadastros/estabelecimentos/1/enriquecimento/aps',
      {
        method: 'PUT',
        body: JSON.stringify({ notas: 'ok' }),
      },
    );
  });

  it('fetchEstabelecimentos without query omits search params', async () => {
    vi.clearAllMocks();
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({
        data: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 1 },
      })
      .mockResolvedValueOnce({
        id: 9,
        perfil: 'APS',
        perfil_editado: false,
      });

    const { fetchEstabelecimentos, fetchEstabelecimentoById } = await import('./cadastros');

    await fetchEstabelecimentos();
    await fetchEstabelecimentoById(9);

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/cadastros/estabelecimentos');
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/cadastros/estabelecimentos/9');
  });

  it('calls sync endpoints', async () => {
    vi.clearAllMocks();
    const syncResult = {
      status: 'ok' as const,
      estabelecimentos: { inserted: 1, updated: 2, inactivated: 0 },
      procedimentos: { inserted: 3, updated: 4, inactivated: 0 },
    };
    const ultima = {
      id: 1,
      status: 'ok',
      sincronizado_em: '2026-06-20T12:00:00Z',
      estabelecimentos: syncResult.estabelecimentos,
      procedimentos: syncResult.procedimentos,
    };

    vi.mocked(apiFetch)
      .mockResolvedValueOnce(syncResult)
      .mockResolvedValueOnce(ultima);

    await sincronizarCadastros();
    await fetchUltimaCadastroSync();

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      '/api/cadastros/sincronizar',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/cadastros/sincronizacoes/ultima');
  });

  it('calls estabelecimentos and procedimentos list endpoints', async () => {
    vi.clearAllMocks();
    vi.mocked(apiFetch)
      .mockResolvedValueOnce({ data: [], pagination: { page: 1, limit: 100, total: 0, pages: 1 } })
      .mockResolvedValueOnce({ data: [], pagination: { page: 1, limit: 100, total: 0, pages: 1 } });

    const { fetchEstabelecimentos, fetchProcedimentos, updateEnriquecimento } = await import(
      './cadastros'
    );

    await fetchEstabelecimentos({ perfil: 'APS' });
    await fetchProcedimentos({ q: '0301' });
    await updateEnriquecimento(1, { notas: 'teste' });

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/api/cadastros/estabelecimentos?perfil=APS');
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/api/cadastros/procedimentos?q=0301');
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      '/api/cadastros/estabelecimentos/1/enriquecimento',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('fetchLeitosVigencias calls the leitos-vigencias list endpoint', async () => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValueOnce([]);

    await fetchLeitosVigencias(1);

    expect(apiFetch).toHaveBeenCalledWith('/api/cadastros/estabelecimentos/1/leitos-vigencias');
  });

  it('createLeitosVigencia posts a new vigencia with JSON body', async () => {
    vi.clearAllMocks();
    const body = {
      vigencia_inicio: '202401',
      vigencia_fim: '999999',
      leitos: { clinico: 10 },
      leitos_detalhe: { '33': 10 },
    };
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: 1, estabelecimento_id: 1, ...body });

    await createLeitosVigencia(1, body);

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/cadastros/estabelecimentos/1/leitos-vigencias',
      { method: 'POST', body: JSON.stringify(body) },
    );
  });

  it('updateLeitosVigencia puts to the specific vigencia endpoint', async () => {
    vi.clearAllMocks();
    const body = {
      vigencia_inicio: '202401',
      vigencia_fim: '202412',
      leitos: { clinico: 5 },
      leitos_detalhe: {},
    };
    vi.mocked(apiFetch).mockResolvedValueOnce({ id: 2, estabelecimento_id: 1, ...body });

    await updateLeitosVigencia(1, 2, body);

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/cadastros/estabelecimentos/1/leitos-vigencias/2',
      { method: 'PUT', body: JSON.stringify(body) },
    );
  });

  it('deleteLeitosVigencia deletes the specific vigencia endpoint', async () => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined);

    await deleteLeitosVigencia(1, 2);

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/cadastros/estabelecimentos/1/leitos-vigencias/2',
      { method: 'DELETE' },
    );
  });
});
