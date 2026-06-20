import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProcedimentos } from '../../api/cadastros';
import { ReadOnlyDataTable } from '../../components/cadastros/ReadOnlyDataTable';
import type { Procedimento } from '../../types/cadastros';
import { buildProcedimentosQuery, formatCatalogCount } from '../../utils/enrichmentView';

const LIST_COLUMNS = [
  { key: 'codigo_sigtap', label: 'SIGTAP', mono: true },
  { key: 'descricao', label: 'Descrição' },
  { key: 'tipo', label: 'Tipo' },
  { key: 'status', label: 'Status' },
];

export function ProcedimentosPage() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Procedimento[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchProcedimentos(buildProcedimentosQuery(appliedSearch, page));
      setRows(result.data);
      setTotal(result.pagination.total);
      setPages(result.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar procedimentos');
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
    <div className="cadastro-page simpa-rise" data-testid="procedimentos-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">Procedimentos</h2>
          <p className="analytics-subtitle">
            Catálogo SIGTAP sincronizado do MySQL — somente leitura.
          </p>
        </div>
      </div>

      <section className="card cadastro-crud-card">
        <div className="cadastro-crud-card-head">
          <h3>Procedimentos ativos</h3>
          <span className="mono cadastro-count">{formatCatalogCount(rows.length, total)}</span>
        </div>

        <form className="cadastro-search-form" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Buscar por código SIGTAP ou descrição…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid="procedimentos-search"
          />
          <button type="submit" className="cadastro-btn">
            Buscar
          </button>
        </form>

        {loading ? (
          <div className="analytics-state">Carregando procedimentos…</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : rows.length === 0 ? (
          <p className="analytics-empty">Nenhum procedimento encontrado.</p>
        ) : (
          <>
            <ReadOnlyDataTable
              columns={LIST_COLUMNS}
              rows={rows as unknown as Record<string, unknown>[]}
            />
            {pages > 1 ? (
              <div className="cadastro-pagination" data-testid="procedimentos-pagination">
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
