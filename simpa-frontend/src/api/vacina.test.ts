import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCobertura, previewVacina, setFaixaGrupo } from './vacina';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './client';

describe('fetchCobertura', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes all provided params in URL', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    await fetchCobertura({ ano: 2026, competencia: '2026-03', grupo_id: 2 });
    const [url] = vi.mocked(apiFetch).mock.calls[0];
    expect(url).toContain('ano=2026');
    expect(url).toContain('competencia=2026-03');
    expect(url).toContain('grupo_id=2');
  });

  it('omits optional params when not provided', async () => {
    vi.mocked(apiFetch).mockResolvedValue([]);
    await fetchCobertura({ ano: 2026 });
    const [url] = vi.mocked(apiFetch).mock.calls[0];
    expect(url).toContain('ano=2026');
    expect(url).not.toContain('competencia');
    expect(url).not.toContain('grupo_id');
  });
});

describe('previewVacina', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts FormData to preview path', async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      competencia: '2026-03',
      doses_total: 100,
      linhas: 50,
      faixas_nao_mapeadas: [],
    });
    const file = new File(['data'], 'vacina.xlsx');
    await previewVacina(file);
    const [url, init] = vi.mocked(apiFetch).mock.calls[0];
    expect(url).toBe('/api/vacina/importacao/preview');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
  });
});

describe('setFaixaGrupo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('encodes faixa in the URL path', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ faixa_nies: '< 1 ano', grupo_id: 1, grupo_nome: 'A' });
    await setFaixaGrupo('< 1 ano', 1);
    const [url] = vi.mocked(apiFetch).mock.calls[0];
    expect(url).toContain(encodeURIComponent('< 1 ano'));
  });
});
