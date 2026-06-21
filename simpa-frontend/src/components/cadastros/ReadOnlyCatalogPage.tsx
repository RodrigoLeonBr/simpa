import { Link } from 'react-router-dom';
import type { CadastroColumnDef } from '../../config/cadastroEntities';
import type { UsePaginatedCatalogReturn } from '../../hooks/usePaginatedCatalog';
import { formatCatalogCount } from '../../utils/enrichmentView';
import { ReadOnlyDataTable } from './ReadOnlyDataTable';

export interface ReadOnlyCatalogTestIds {
  page: string;
  search: string;
  pagination: string;
}

export interface ReadOnlyCatalogPageProps<T> {
  title: string;
  subtitle: string;
  sectionTitle: string;
  columns: CadastroColumnDef[];
  catalog: UsePaginatedCatalogReturn<T>;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingMessage: string;
  testIds: ReadOnlyCatalogTestIds;
  backTo?: string;
}

export function ReadOnlyCatalogPage<T extends { id?: number | string }>({
  title,
  subtitle,
  sectionTitle,
  columns,
  catalog,
  searchPlaceholder,
  emptyMessage,
  loadingMessage,
  testIds,
  backTo = '/cadastros',
}: ReadOnlyCatalogPageProps<T>) {
  const {
    search,
    setSearch,
    page,
    setPage,
    rows,
    total,
    pages,
    loading,
    error,
    handleSearch,
  } = catalog;

  return (
    <div className="cadastro-page simpa-rise" data-testid={testIds.page}>
      <div className="cadastro-crud-head">
        <div>
          <Link to={backTo} className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">{title}</h2>
          <p className="analytics-subtitle">{subtitle}</p>
        </div>
      </div>

      <section className="card cadastro-crud-card">
        <div className="cadastro-crud-card-head">
          <h3>{sectionTitle}</h3>
          <span className="mono cadastro-count">{formatCatalogCount(rows.length, total)}</span>
        </div>

        <form className="cadastro-search-form" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            data-testid={testIds.search}
          />
          <button type="submit" className="cadastro-btn">
            Buscar
          </button>
        </form>

        {loading ? (
          <div className="analytics-state">{loadingMessage}</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : rows.length === 0 ? (
          <p className="analytics-empty">{emptyMessage}</p>
        ) : (
          <>
            <ReadOnlyDataTable
              columns={columns}
              rows={rows as unknown as Record<string, unknown>[]}
            />
            {pages > 1 ? (
              <div className="cadastro-pagination" data-testid={testIds.pagination}>
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
