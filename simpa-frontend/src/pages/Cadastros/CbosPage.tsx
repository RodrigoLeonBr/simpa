import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchCbos } from '../../api/cadastros';
import { ReadOnlyDataTable } from '../../components/cadastros/ReadOnlyDataTable';
import type { Cbo } from '../../types/cadastros';
import { buildCbosQuery, formatCatalogCount } from '../../utils/enrichmentView';

const LIST_COLUMNS = [
  { key: 'codigo_cbo', label: 'CBO', mono: true },
  { key: 'descricao', label: 'Descrição' },
  { key: 'status', label: 'Status' },
];

export function CbosPage() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Cbo[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchCbos(buildCbosQuery(appliedSearch, page));
      setRows(result.data);
      setTotal(result.pagination.total);
      setPages(result.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar CBOs');
      setRows([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  };

  return (
    <div className="cadastro-page simpa-rise" data-testid="cbos-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">CBOs</h2>
          <p className="analytics-subtitle">
            Classificação Brasileira de Ocupações sincronizada do MySQL SIA — somente leitura.
          </p>
        </div>
      </div>

      <section className="card cadastro-crud-card">
        <div className="cadastro-crud-card-head">
          <h3>CBOs ativos</h3>
          <span className="mono cadastro-count">{formatCatalogCount(rows.length, total)}</span>
        </div>

        <form className="cadastro-search-form" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Buscar por código CBO ou descrição…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="cbos-search"
          />
          <button type="submit" className="cadastro-btn">
            Buscar
          </button>
        </form>

        {loading ? (
          <div className="analytics-state">Carregando CBOs…</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : rows.length === 0 ? (
          <p className="analytics-empty">Nenhum CBO encontrado.</p>
        ) : (
          <>
            <ReadOnlyDataTable
              columns={LIST_COLUMNS}
              rows={rows as unknown as Record<string, unknown>[]}
            />
            {pages > 1 ? (
              <div className="cadastro-pagination" data-testid="cbos-pagination">
                <button
                  type="button"
                  className="cadastro-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  Anterior
                </button>
                <span className="mono">
                  Página {page} de {pages}
                </span>
                <button
                  type="button"
                  className="cadastro-btn"
                  disabled={page >= pages}
                  onClick={() => setPage((current) => Math.min(pages, current + 1))}
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
