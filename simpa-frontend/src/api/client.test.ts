import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiBase, apiFetch, setTokenProvider, setUnauthorizedHandler } from './client';

describe('apiFetch', () => {
  beforeEach(() => {
    setTokenProvider(null);
    setUnauthorizedHandler(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setTokenProvider(null);
    setUnauthorizedHandler(null);
  });

  it('sends Authorization header when token provider returns a token', async () => {
    setTokenProvider(() => 'jwt-123');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    await apiFetch('/dashboard');

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer jwt-123');
  });

  it('does not set Content-Type for multipart uploads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    const form = new FormData();
    form.append('files', new File(['a'], 'a.csv', { type: 'text/csv' }));

    await apiFetch('/api/importacao/preview', { method: 'POST', body: form });

    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get('Content-Type')).toBeNull();
  });

  it('uses dev API fallback when VITE_API_BASE is empty', () => {
    vi.stubEnv('VITE_API_BASE', '');
    vi.stubEnv('DEV', true);
    expect(apiBase()).toBe('http://localhost:3001');
  });

  it('uses same-origin when VITE_API_BASE is empty in production', () => {
    vi.stubEnv('VITE_API_BASE', '');
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    expect(apiBase()).toBe('');
  });

  it('strips trailing slash from configured API base', () => {
    vi.stubEnv('VITE_API_BASE', 'http://localhost:3001/');
    expect(apiBase()).toBe('http://localhost:3001');
  });

  it('throws API error message for non-401 failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Server Error',
        json: async () => ({ error: 'Falha interna' }),
      }),
    );

    await expect(apiFetch('/dashboard')).rejects.toThrow('Falha interna');
  });

  it('falls back to HTTP status when error body is invalid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('invalid json');
        },
      }),
    );

    await expect(apiFetch('/dashboard')).rejects.toThrow('Bad Gateway');
  });
});
