import { act, renderHook, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type PaginatedCatalogResult, usePaginatedCatalog } from './usePaginatedCatalog';

function mockResult<T>(data: T[], total = data.length, pages = 1) {
  return {
    data,
    pagination: { page: 1, limit: 200, total, pages },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('usePaginatedCatalog', () => {
  it('loads rows on mount', async () => {
    const fetchPage = vi.fn().mockResolvedValue(mockResult([{ id: 'a' }]));
    const buildQuery = vi.fn().mockReturnValue({ limit: '200', page: '1' });

    const { result } = renderHook(() => usePaginatedCatalog({ fetchPage, buildQuery }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(buildQuery).toHaveBeenCalledWith('', 1);
    expect(fetchPage).toHaveBeenCalledWith({ limit: '200', page: '1' });
    expect(result.current.rows).toEqual([{ id: 'a' }]);
    expect(result.current.total).toBe(1);
    expect(result.current.pages).toBe(1);
  });

  it('handleSearch applies search and resets page to 1', async () => {
    const fetchPage = vi.fn().mockResolvedValue(mockResult([{ id: 'b' }], 1, 1));
    const buildQuery = vi.fn((search: string, page: number) => ({
      limit: '200',
      page: String(page),
      ...(search.trim() ? { q: search.trim() } : {}),
    }));

    const { result } = renderHook(() => usePaginatedCatalog({ fetchPage, buildQuery }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPage(3);
    });
    await waitFor(() => expect(result.current.page).toBe(3));

    act(() => {
      result.current.setSearch('forma');
    });

    act(() => {
      result.current.handleSearch({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    await waitFor(() => expect(result.current.appliedSearch).toBe('forma'));
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(buildQuery).toHaveBeenLastCalledWith('forma', 1));
    expect(result.current.rows).toEqual([{ id: 'b' }]);
  });

  it('setPage triggers refetch with new page', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce(mockResult([], 400, 2))
      .mockResolvedValueOnce(mockResult([], 400, 2));
    const buildQuery = vi
      .fn()
      .mockReturnValueOnce({ limit: '200', page: '1' })
      .mockReturnValueOnce({ limit: '200', page: '2' });

    const { result } = renderHook(() => usePaginatedCatalog({ fetchPage, buildQuery }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(buildQuery).toHaveBeenLastCalledWith('', 2);
  });

  it('clears rows and sets error when fetch fails', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error('rede indisponível'));
    const buildQuery = vi.fn().mockReturnValue({ limit: '200', page: '1' });

    const { result } = renderHook(() =>
      usePaginatedCatalog({
        fetchPage,
        buildQuery,
        errorMessage: 'Falha ao carregar formas',
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('rede indisponível');
    expect(result.current.rows).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.pages).toBe(1);
  });

  it('uses custom errorMessage for non-Error rejections', async () => {
    const fetchPage = vi.fn().mockRejectedValue('timeout');
    const buildQuery = vi.fn().mockReturnValue({ limit: '200', page: '1' });

    const { result } = renderHook(() =>
      usePaginatedCatalog({
        fetchPage,
        buildQuery,
        errorMessage: 'Falha ao carregar CBOs',
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Falha ao carregar CBOs');
  });

  it('ignores stale responses from previous requests', async () => {
    const first = deferred<PaginatedCatalogResult<{ id: string }>>();
    const second = deferred<PaginatedCatalogResult<{ id: string }>>();
    const fetchPage = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    const buildQuery = vi
      .fn()
      .mockReturnValueOnce({ limit: '200', page: '1' })
      .mockReturnValueOnce({ limit: '200', page: '2' });

    const { result } = renderHook(() => usePaginatedCatalog({ fetchPage, buildQuery }));

    act(() => {
      result.current.setPage(2);
    });

    act(() => {
      second.resolve(mockResult([{ id: 'new' }]));
    });
    await waitFor(() => expect(result.current.rows).toEqual([{ id: 'new' }]));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      first.resolve(mockResult([{ id: 'stale' }]));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.rows).toEqual([{ id: 'new' }]);
  });
});
