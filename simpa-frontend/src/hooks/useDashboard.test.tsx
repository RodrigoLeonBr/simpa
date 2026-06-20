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
  fetchEstabelecimentosAps: vi.fn(),
  fetchEquipes: vi.fn(),
}));

import { fetchDashboard } from '../api/dashboard';
import { fetchEquipes, fetchEstabelecimentosAps } from '../api/cadastros';

function Wrapper({ children }: { children: ReactNode }) {
  return <FiltersProvider>{children}</FiltersProvider>;
}

describe('useDashboard', () => {
  beforeEach(() => {
    vi.mocked(fetchEstabelecimentosAps).mockResolvedValue(
      mockDb.estabelecimentos.filter((item) => item.perfil === 'APS') as never,
    );
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
    let resolveAps: (value: unknown) => void = () => {};
    vi.mocked(fetchEstabelecimentosAps).mockReturnValue(
      new Promise((resolve) => {
        resolveAps = resolve;
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
      resolveAps(mockDb.estabelecimentos.filter((item) => item.perfil === 'APS'));
    });

    await waitFor(() => {
      expect(callsWithUnit().length).toBeGreaterThan(0);
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
