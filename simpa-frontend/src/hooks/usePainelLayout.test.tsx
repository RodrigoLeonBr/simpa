import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { FiltersProvider, useFilters } from './useFilters';
import { usePainelLayout } from './usePainelLayout';

vi.mock('../api/painelWidgets', () => ({
  fetchPainelLayout: vi.fn(),
}));

import { fetchPainelLayout } from '../api/painelWidgets';

function Wrapper({ children }: { children: ReactNode }) {
  return <FiltersProvider>{children}</FiltersProvider>;
}

describe('usePainelLayout', () => {
  beforeEach(() => {
    vi.mocked(fetchPainelLayout).mockReset();
    vi.mocked(fetchPainelLayout).mockResolvedValue({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
      widgets: [{ slug: 'w1' }],
    } as never);
  });

  it('quando painelPerfil MAC não chama fetchPainelLayout', async () => {
    const { result } = renderHook(
      () => ({
        hook: usePainelLayout(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.hook.loading).toBe(false));
    vi.mocked(fetchPainelLayout).mockClear();

    act(() => {
      result.current.filters.setPainelPerfil('MAC');
    });

    await waitFor(() => {
      expect(result.current.hook.loading).toBe(false);
      expect(result.current.hook.layout).toBeNull();
      expect(fetchPainelLayout).not.toHaveBeenCalled();
    });
  });

  it('quando APS e competencia muda, chama fetch duas vezes', async () => {
    const { result } = renderHook(
      () => ({
        hook: usePainelLayout(),
        filters: useFilters(),
      }),
      { wrapper: Wrapper }
    );

    await waitFor(() => expect(result.current.hook.loading).toBe(false));
    const callsBefore = vi.mocked(fetchPainelLayout).mock.calls.length;

    act(() => {
      result.current.filters.setCompetencia('2026-04');
    });

    await waitFor(() => {
      expect(vi.mocked(fetchPainelLayout).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    expect(fetchPainelLayout).toHaveBeenLastCalledWith(
      expect.objectContaining({ competencia: '2026-04' })
    );
  });

  it('erro 404 da API define estado de erro sem lançar', async () => {
    vi.mocked(fetchPainelLayout).mockRejectedValueOnce(new Error('HTTP 404'));

    const { result } = renderHook(() => usePainelLayout(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Layout dinâmico não encontrado para os filtros informados');
      expect(result.current.layout).toBeNull();
    });
  });

  it('mensagem "não encontrado" também mapeia para erro amigável de ausência', async () => {
    vi.mocked(fetchPainelLayout).mockRejectedValueOnce(new Error('recurso não encontrado'));

    const { result } = renderHook(() => usePainelLayout(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Layout dinâmico não encontrado para os filtros informados');
    });
  });

  it('erro genérico mapeia para mensagem padrão em português', async () => {
    vi.mocked(fetchPainelLayout).mockRejectedValueOnce(new Error('timeout'));

    const { result } = renderHook(() => usePainelLayout(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Falha ao carregar layout dinâmico do painel');
      expect(result.current.layout).toBeNull();
    });
  });

  it('erro não-Error também cai na mensagem padrão', async () => {
    vi.mocked(fetchPainelLayout).mockRejectedValueOnce('falha');

    const { result } = renderHook(() => usePainelLayout(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe('Falha ao carregar layout dinâmico do painel');
    });
  });

  it('sucesso preenche layout com widgets', async () => {
    vi.mocked(fetchPainelLayout).mockResolvedValueOnce({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
      widgets: [{ slug: 'w1' }, { slug: 'w2' }],
    } as never);

    const { result } = renderHook(() => usePainelLayout(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.layout?.widgets).toHaveLength(2);
    });
  });

  it('refetch força nova chamada mantendo filtro atual', async () => {
    const { result } = renderHook(() => usePainelLayout(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const initialCalls = vi.mocked(fetchPainelLayout).mock.calls.length;

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(vi.mocked(fetchPainelLayout).mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
