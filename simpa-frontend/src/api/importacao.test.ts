import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCargas, previewUpload } from './importacao';

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
