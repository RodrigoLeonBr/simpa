import { useCallback, useEffect, useState, type FormEvent } from 'react';

export interface PaginatedCatalogResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface UsePaginatedCatalogOptions<T> {
  fetchPage: (query: Record<string, string>) => Promise<PaginatedCatalogResult<T>>;
  buildQuery: (search: string, page: number) => Record<string, string>;
  errorMessage?: string;
}

export interface UsePaginatedCatalogReturn<T> {
  search: string;
  setSearch: (value: string) => void;
  appliedSearch: string;
  page: number;
  setPage: (value: number | ((current: number) => number)) => void;
  rows: T[];
  total: number;
  pages: number;
  loading: boolean;
  error: string | null;
  carregar: () => Promise<void>;
  handleSearch: (event: FormEvent) => void;
}

export function usePaginatedCatalog<T>(
  options: UsePaginatedCatalogOptions<T>,
): UsePaginatedCatalogReturn<T> {
  const { fetchPage, buildQuery, errorMessage = 'Falha ao carregar dados' } = options;

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchPage(buildQuery(appliedSearch, page));
      setRows(result.data);
      setTotal(result.pagination.total);
      setPages(result.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : errorMessage);
      setRows([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, fetchPage, buildQuery, errorMessage]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleSearch = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      setAppliedSearch(search);
      setPage(1);
    },
    [search],
  );

  return {
    search,
    setSearch,
    appliedSearch,
    page,
    setPage,
    rows,
    total,
    pages,
    loading,
    error,
    carregar,
    handleSearch,
  };
}
