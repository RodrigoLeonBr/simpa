import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FiltersProvider, useFilters } from './useFilters';
import { useDashboard } from './useDashboard';
import mockDb from '../../mock/db.json';

vi.mock('../api/dashboard', () => ({
  fetchDashboard: vi.fn(),
}));

vi.mock('../api/cadastros', () => ({
  fetchEstabelecimentos: vi.fn(),
  fetchEquipes: vi.fn(),
}));

import { fetchDashboard } from '../api/dashboard';
import { fetchEquipes, fetchEstabelecimentos } from '../api/cadastros';

function Wrapper({ children }: { children: ReactNode }) {
  return <FiltersProvider>{children}</FiltersProvider>;
}

function mockEstabelecimentosForPerfil(perfil: string) {
  return {
    data: mockDb.estabelecimentos.filter((item) => item.perfil === perfil),
    pagination: { page: 1, limit: 200, total: 1, pages: 1 },
  };
}

describe('useDashboard', () => {
  beforeEach(() => {
    vi.mocked(fetchEstabelecimentos).mockImplementation(async (query) => {
      const perfil = String(query?.perfil ?? 'APS');
      return mockEstabelecimentosForPerfil(perfil) as never;
    });
    vi.mocked(fetchEquipes).mockResolvedValue(mockDb.equipes as never);
    vi.mocked(fetchDashboard).mockResolvedValue(mockDb.planejamento[0] as never);
  });

  it('refetches when filter changes', async () => {
    const { result } = renderHook(
      () => ({
        dashboard: useDashboard(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.dashboard.loading).toBe(false);
    });

    const initialCalls = vi.mocked(fetchDashboard).mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    act(() => {
      result.current.filters.setCompetencia('2026-04');
    });

    await waitFor(() => {
      expect(vi.mocked(fetchDashboard).mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it('with painelPerfil MAC calls fetch with perfil=MAC', async () => {
    const { result } = renderHook(
      () => ({
        dashboard: useDashboard(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.dashboard.loading).toBe(false));

    vi.mocked(fetchEstabelecimentos).mockClear();

    act(() => {
      result.current.filters.setPainelPerfil('MAC');
    });

    await waitFor(() => {
      expect(fetchEstabelecimentos).toHaveBeenCalledWith(
        expect.objectContaining({ perfil: 'MAC', limit: 200 }),
      );
    });
  });

  it('updates unidades when painelPerfil changes from APS to Hospitalar', async () => {
    const { result } = renderHook(
      () => ({
        dashboard: useDashboard(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.dashboard.unidades.length).toBeGreaterThan(0);
      expect(result.current.dashboard.unidades.every((item) => item.tipo === 'APS')).toBe(true);
    });

    act(() => {
      result.current.filters.setPainelPerfil('Hospitalar');
    });

    await waitFor(() => {
      expect(result.current.dashboard.unidades).toHaveLength(1);
      expect(result.current.dashboard.unidades[0]?.tipo).toBe('Hospitalar');
    });
  });

  it('full load cycle with perfil switch does not throw', async () => {
    const { result } = renderHook(
      () => ({
        dashboard: useDashboard(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.dashboard.loading).toBe(false));

    await act(async () => {
      result.current.filters.setPainelPerfil('MAC');
    });

    await waitFor(() => expect(result.current.dashboard.loading).toBe(false));

    await act(async () => {
      result.current.filters.setPainelPerfil('Hospitalar');
    });

    await waitFor(() => {
      expect(result.current.dashboard.loading).toBe(false);
      expect(result.current.dashboard.error).toBeNull();
    });
  });

  it('passes resolved unidade and equipe names to fetchDashboard', async () => {
    const { result } = renderHook(
      () => ({
        dashboard: useDashboard(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.dashboard.loading).toBe(false));

    act(() => {
      result.current.filters.setUnidadeId(1);
      result.current.filters.setEquipeId(1);
    });

    await waitFor(() => {
      expect(fetchDashboard).toHaveBeenCalledWith(
        '2026-05',
        'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
        'EQUIPE 9 EAP',
      );
    });
  });

  it('waits for unidades before applying unit filter to dashboard', async () => {
    vi.mocked(fetchDashboard).mockClear();
    let resolveEstabelecimentos: (value: unknown) => void = () => {};
    vi.mocked(fetchEstabelecimentos).mockReturnValue(
      new Promise((resolve) => {
        resolveEstabelecimentos = resolve;
      }) as never,
    );

    const { result } = renderHook(
      () => ({
        dashboard: useDashboard(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper },
    );

    act(() => {
      result.current.filters.setUnidadeId(1);
    });

    const callsWithUnit = () =>
      vi.mocked(fetchDashboard).mock.calls.filter(
        (call) => call[1] === 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
      );

    expect(callsWithUnit()).toHaveLength(0);

    await act(async () => {
      resolveEstabelecimentos(mockEstabelecimentosForPerfil('APS'));
    });

    await waitFor(() => {
      expect(callsWithUnit().length).toBeGreaterThan(0);
    });
  });

  it('clears dashboard data while establishments reload after perfil change', async () => {
    const { result } = renderHook(
      () => ({
        dashboard: useDashboard(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.dashboard.loading).toBe(false);
      expect(result.current.dashboard.data).not.toBeNull();
    });

    let resolveEstabelecimentos: (value: unknown) => void = () => {};
    vi.mocked(fetchEstabelecimentos).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveEstabelecimentos = resolve;
      }) as never,
    );

    act(() => {
      result.current.filters.setPainelPerfil('Hospitalar');
    });

    await waitFor(() => {
      expect(result.current.dashboard.data).toBeNull();
    });

    await act(async () => {
      resolveEstabelecimentos(mockEstabelecimentosForPerfil('Hospitalar'));
    });

    await waitFor(() => {
      expect(result.current.dashboard.loading).toBe(false);
      expect(result.current.dashboard.data).toBeNull();
    });
  });

  it('does not fetch dashboard payload for pending catalog profiles', async () => {
    const { result } = renderHook(
      () => ({
        dashboard: useDashboard(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => expect(result.current.dashboard.loading).toBe(false));

    vi.mocked(fetchDashboard).mockClear();

    act(() => {
      result.current.filters.setPainelPerfil('MAC');
    });

    await waitFor(() => {
      expect(result.current.dashboard.loading).toBe(false);
      expect(result.current.dashboard.data).toBeNull();
      expect(fetchDashboard).not.toHaveBeenCalled();
    });
  });

  it('stores error message when dashboard fetch fails', async () => {
    vi.mocked(fetchDashboard).mockReset();
    vi.mocked(fetchDashboard).mockRejectedValue(new Error('Falha API'));

    const { result } = renderHook(() => useDashboard(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Falha API');
    });
  });
});
