import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, setTokenProvider, setUnauthorizedHandler } from './client';

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
