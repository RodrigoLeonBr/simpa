import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildUploadFormData,
  createMapeamento,
  deleteMapeamento,
  fetchCargas,
  fetchMapeamentos,
  previewUpload,
  updateMapeamento,
  uploadCargas,
} from './importacao';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './client';

describe('importacao api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetchCargas calls cargas endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    await fetchCargas({ competencia: '2026-05', unidade: 'CAFI' });

    expect(apiFetch).toHaveBeenCalledWith('/api/importacao/cargas?competencia=2026-05&unidade=CAFI');
  });

  it('previewUpload sends multipart form data', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    const file = new File(['a,b'], 'relatorio.csv', { type: 'text/csv' });

    await previewUpload([file]);

    const call = vi.mocked(apiFetch).mock.calls.at(-1);
    expect(call?.[1]?.method).toBe('POST');
    expect(call?.[1]?.body).toBeInstanceOf(FormData);
  });

  it('uploadCargas appends resolucoes JSON string to FormData', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    const file = new File(['a,b'], 'relatorio.csv', { type: 'text/csv' });
    const resolucoes = [
      {
        arquivo: 'relatorio.csv',
        estabelecimento_id: 42,
        equipe_id: 7,
        salvar_mapeamento: true,
      },
    ];

    await uploadCargas([file], resolucoes);

    const call = vi.mocked(apiFetch).mock.calls.at(-1);
    const body = call?.[1]?.body as FormData;
    expect(body.get('resolucoes')).toBe(JSON.stringify(resolucoes));
    expect(body.getAll('files')).toHaveLength(1);
  });

  it('buildUploadFormData serializes resolucoes field', () => {
    const file = new File(['a,b'], 'relatorio.csv', { type: 'text/csv' });
    const form = buildUploadFormData([file], [
      {
        arquivo: 'relatorio.csv',
        estabelecimento_id: 1,
        equipe_id: 2,
        salvar_mapeamento: false,
        confirmar_remocao_todas: true,
      },
    ]);

    expect(form.get('resolucoes')).toContain('confirmar_remocao_todas');
  });

  it('fetchMapeamentos calls mapeamentos endpoint with query', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ data: [], pagination: { page: 1, limit: 50, total: 0, pages: 1 } });

    await fetchMapeamentos({ q: 'CAFI', page: 2, limit: 10 });

    expect(apiFetch).toHaveBeenCalledWith('/api/importacao/mapeamentos?q=CAFI&page=2&limit=10');
  });

  it('mapeamentos CRUD calls expected endpoints', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ id: 1 });

    await createMapeamento({
      esus_unidade_label: 'CAFI',
      estabelecimento_id: 42,
      equipe_id: 7,
    });
    await updateMapeamento(3, { estabelecimento_id: 42 });
    await deleteMapeamento(3);

    expect(apiFetch).toHaveBeenCalledWith('/api/importacao/mapeamentos', expect.objectContaining({ method: 'POST' }));
    expect(apiFetch).toHaveBeenCalledWith('/api/importacao/mapeamentos/3', expect.objectContaining({ method: 'PUT' }));
    expect(apiFetch).toHaveBeenCalledWith('/api/importacao/mapeamentos/3', expect.objectContaining({ method: 'DELETE' }));
  });

  it('calls reprocess, substitute and delete endpoints', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ok: true });
    const file = new File(['a,b'], 'relatorio.csv', { type: 'text/csv' });

    const { reprocessarCarga, substituirCarga, excluirCarga } = await import('./importacao');

    await reprocessarCarga(7);
    await substituirCarga(7, file);
    await excluirCarga(7);

    expect(apiFetch).toHaveBeenCalledWith('/api/importacao/7/reprocessar', { method: 'POST' });
    expect(apiFetch).toHaveBeenCalledWith('/api/importacao/7/substituir', expect.objectContaining({ method: 'PUT' }));
    expect(apiFetch).toHaveBeenCalledWith('/api/importacao/7', { method: 'DELETE' });
  });
});
