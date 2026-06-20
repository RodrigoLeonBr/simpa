import { useCallback, useEffect, useState } from 'react';
import { fetchEstabelecimentos } from '../../api/cadastros';
import { ReadOnlyDataTable } from '../../components/cadastros/ReadOnlyDataTable';
import type { Estabelecimento, EstabelecimentoPerfilFilter } from '../../types/cadastros';
import {
  buildEstabelecimentosQuery,
  formatCatalogCount,
} from '../../utils/enrichmentView';
import {
  EstabelecimentoDetailDrawer,
  EstabelecimentosPageShell,
} from './EstabelecimentoDetailDrawer';

const PERFIL_CHIPS: { key: EstabelecimentoPerfilFilter; label: string }[] = [
  { key: '', label: 'Todos' },
  { key: 'APS', label: 'APS' },
  { key: 'MAC', label: 'MAC' },
  { key: 'Hospitalar', label: 'Hospitalar' },
  { key: 'Misto', label: 'Misto' },
];

const LIST_COLUMNS = [
  { key: 'codigo_externo', label: 'Código', mono: true },
  { key: 'nome', label: 'Nome' },
  { key: 'perfil', label: 'Perfil' },
  { key: 'status', label: 'Status' },
];

export function EstabelecimentosPage() {
  const [perfil, setPerfil] = useState<EstabelecimentoPerfilFilter>('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Estabelecimento[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Estabelecimento | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchEstabelecimentos(
        buildEstabelecimentosQuery(perfil, appliedSearch, page),
      );
      setRows(result.data);
      setTotal(result.pagination.total);
      setPages(result.pagination.pages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar estabelecimentos');
      setRows([]);
      setTotal(0);
      setPages(1);
    } finally {
      setLoading(false);
    }
  }, [perfil, appliedSearch, page]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  };

  const handlePerfilChange = (next: EstabelecimentoPerfilFilter) => {
    setPerfil(next);
    setPage(1);
  };

  return (
    <EstabelecimentosPageShell>
      <section className="card cadastro-crud-card">
        <div className="cadastro-crud-card-head">
          <h3>Prestadores sincronizados</h3>
          <span className="mono cadastro-count">{formatCatalogCount(rows.length, total)}</span>
        </div>

        <div className="cadastro-filter-bar">
          <div className="cadastro-profile-chips" role="group" aria-label="Filtrar por perfil">
            {PERFIL_CHIPS.map((chip) => (
              <button
                key={chip.key || 'all'}
                type="button"
                className={`cadastro-chip${perfil === chip.key ? ' active' : ''}`}
                data-testid={`perfil-chip-${chip.key || 'all'}`}
                onClick={() => handlePerfilChange(chip.key)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <form className="cadastro-search-form" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Buscar por nome ou código…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              data-testid="estabelecimentos-search"
            />
            <button type="submit" className="cadastro-btn">
              Buscar
            </button>
          </form>
        </div>

        {loading ? (
          <div className="analytics-state">Carregando estabelecimentos…</div>
        ) : error ? (
          <div className="analytics-state analytics-state-error">{error}</div>
        ) : rows.length === 0 ? (
          <p className="analytics-empty">Nenhum estabelecimento encontrado.</p>
        ) : (
          <>
            <ReadOnlyDataTable
              columns={LIST_COLUMNS}
              rows={rows as unknown as Record<string, unknown>[]}
              onRowClick={(row) => setSelected(row as unknown as Estabelecimento)}
            />
            {pages > 1 ? (
              <div className="cadastro-pagination" data-testid="estabelecimentos-pagination">
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

      {selected ? (
        <EstabelecimentoDetailDrawer
          estabelecimento={selected}
          onClose={() => setSelected(null)}
          onSaved={(updated) => {
            setSelected(updated);
            setRows((current) =>
              current.map((row) => (row.id === updated.id ? updated : row)),
            );
          }}
        />
      ) : null}
    </EstabelecimentosPageShell>
  );
}
