import { useCallback, useEffect, useState } from 'react';
import { fetchAuditLog } from '../../api/admin';
import type { AuditLogEntry } from '../../types/admin';
import { formatAdminDate } from '../../utils/adminView';

export function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditLog({ page, limit: 20 });
      setEntries(res.data);
      setTotalPages(res.pagination.pages);
      setTotal(res.pagination.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar auditoria');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <section className="cadastro-crud-page" data-testid="admin-audit-page">
      <div>
        <h2 className="analytics-title">Auditoria</h2>
        <p className="analytics-subtitle">
          Trilha de ações administrativas, logins e exportações
        </p>
      </div>

      {loading ? (
        <div className="analytics-state">Carregando registros…</div>
      ) : error ? (
        <div className="analytics-state analytics-state-error">{error}</div>
      ) : entries.length === 0 ? (
        <div className="analytics-state" data-testid="admin-audit-empty">
          Nenhum registro de auditoria encontrado.
        </div>
      ) : (
        <>
          <div className="cadastro-table-wrap">
            <table className="cadastro-table" data-testid="admin-audit-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Recurso</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="mono">{formatAdminDate(entry.criado_em)}</td>
                    <td>{entry.username ?? '—'}</td>
                    <td className="mono">{entry.acao}</td>
                    <td className="mono">{entry.recurso ?? '—'}</td>
                    <td className="mono">{entry.ip ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cadastro-pagination" data-testid="admin-audit-pagination">
            <span className="mono">
              {total} registro{total === 1 ? '' : 's'} · página {page} de {totalPages}
            </span>
            <div className="cadastro-pagination-actions">
              <button
                type="button"
                className="cadastro-btn ghost"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Anterior
              </button>
              <button
                type="button"
                className="cadastro-btn ghost"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Próxima
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
