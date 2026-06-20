import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './client';
import { fetchDashboard } from './dashboard';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

describe('fetchDashboard', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockResolvedValue({ versao_schema: '3.1.0' });
  });

  it('requests municipal aggregate when only competencia is provided', async () => {
    await fetchDashboard('2026-01');

    expect(apiFetch).toHaveBeenCalledWith('/api/v1/dashboard/planejamento?competencia=2026-01');
  });

  it('requests estabelecimento_id when estabelecimentoId filter is set', async () => {
    await fetchDashboard('2026-01', { estabelecimentoId: 42 });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/dashboard/planejamento?competencia=2026-01&estabelecimento_id=42',
    );
  });

  it('requests both ID params when estabelecimentoId and equipeId are set', async () => {
    await fetchDashboard('2026-05', { estabelecimentoId: 42, equipeId: 7 });

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/v1/dashboard/planejamento?competencia=2026-05&estabelecimento_id=42&equipe_id=7',
    );
  });
});
