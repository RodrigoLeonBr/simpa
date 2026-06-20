import { useCallback, useEffect, useState } from 'react';
import { fetchEstabelecimentos } from '../../api/cadastros';
import { deleteMapeamento, fetchMapeamentos, updateMapeamento } from '../../api/importacao';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import type { EsusImportMapeamento } from '../../types/importacao';

function formatCadastroRow(item: EsusImportMapeamento): string {
  const parts = [item.estabelecimento_codigo, item.estabelecimento_nome].filter(Boolean);
  if (parts.length) {
    return parts.join(' · ');
  }
  return `Estab. #${item.estabelecimento_id}`;
}

export function MapeamentosPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const [items, setItems] = useState<EsusImportMapeamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [deleteTarget, setDeleteTarget] = useState<EsusImportMapeamento | null>(null);
  const [editTarget, setEditTarget] = useState<EsusImportMapeamento | null>(null);
  const [editEstabelecimentoId, setEditEstabelecimentoId] = useState<number | ''>('');
  const [estabelecimentoOptions, setEstabelecimentoOptions] = useState<
    { id: number; codigo_externo: string; nome: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const { toast, showToast } = useToast();

  const carregar = useCallback(async (search?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchMapeamentos({ q: search?.trim() || undefined, limit: 100 });
      setItems(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar mapeamentos');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar(initialQuery);
  }, [carregar, initialQuery]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void carregar(query);
  };

  const openEdit = async (item: EsusImportMapeamento) => {
    setEditTarget(item);
    setEditEstabelecimentoId(item.estabelecimento_id);
    try {
      const response = await fetchEstabelecimentos({ limit: 50 });
      setEstabelecimentoOptions(
        response.data.map((est) => ({
          id: est.id,
          codigo_externo: est.codigo_externo,
          nome: est.nome,
        })),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao carregar estabelecimentos');
    }
  };

  const handleSaveEdit = async () => {
    if (!editTarget || editEstabelecimentoId === '') return;

    setBusy(true);
    try {
      await updateMapeamento(editTarget.id, { estabelecimento_id: Number(editEstabelecimentoId) });
      setEditTarget(null);
      showToast('Mapeamento atualizado');
      await carregar(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao salvar mapeamento');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setBusy(true);
    try {
      await deleteMapeamento(deleteTarget.id);
      setDeleteTarget(null);
      showToast('Mapeamento inativado');
      await carregar(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao inativar mapeamento');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="import-mapeamentos card" data-testid="mapeamentos-panel">
      <div className="import-mapeamentos-head">
        <div>
          <h3>Mapeamentos e-SUS → cadastro</h3>
          <p>Vínculos persistentes entre rótulos do e-SUS e estabelecimentos do SIMPA.</p>
        </div>
        <form className="import-mapeamentos-search" onSubmit={handleSearch}>
          <input
            type="search"
            placeholder="Buscar unidade ou equipe…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-testid="mapeamentos-search"
          />
          <button type="submit" className="btn-ghost">
            Buscar
          </button>
        </form>
      </div>

      {loading ? (
        <div className="analytics-state">Carregando mapeamentos…</div>
      ) : error ? (
        <div className="analytics-state analytics-state-error">{error}</div>
      ) : items.length === 0 ? (
        <div className="analytics-state">Nenhum mapeamento cadastrado.</div>
      ) : (
        <div className="import-mapeamentos-table-wrap">
          <table className="import-mapeamentos-table">
            <thead>
              <tr>
                <th>Unidade e-SUS</th>
                <th>Equipe e-SUS</th>
                <th>Cadastro</th>
                <th>Último uso</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} data-testid="mapeamento-row">
                  <td>{item.esus_unidade_label}</td>
                  <td>{item.esus_equipe_nome || item.esus_equipe_codigo || '—'}</td>
                  <td className="mono">{formatCadastroRow(item)}</td>
                  <td className="mono">
                    {item.ultimo_uso_em
                      ? new Date(item.ultimo_uso_em).toLocaleString('pt-BR')
                      : '—'}
                  </td>
                  <td className="import-mapeamentos-actions">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => void openEdit(item)}
                      data-testid={`mapeamento-edit-${item.id}`}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn-ghost danger"
                      onClick={() => setDeleteTarget(item)}
                      data-testid={`mapeamento-delete-${item.id}`}
                    >
                      Inativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Inativar mapeamento"
        message={
          deleteTarget
            ? `Inativar vínculo de "${deleteTarget.esus_unidade_label}"? Próximas importações exigirão seleção manual.`
            : ''
        }
        confirmLabel="Inativar"
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />

      {editTarget ? (
        <div className="cadastro-dialog-backdrop" data-testid="mapeamento-edit-dialog">
          <div className="cadastro-dialog card cadastro-confirm-dialog" role="dialog" aria-modal="true">
            <div className="cadastro-dialog-head">
              <h3>Editar mapeamento</h3>
            </div>
            <p className="cadastro-confirm-message mono">
              {editTarget.esus_unidade_label}
              {editTarget.esus_equipe_nome ? ` · ${editTarget.esus_equipe_nome}` : ''}
            </p>
            <label className="import-mapping-picker">
              <span>Estabelecimento</span>
              <select
                value={editEstabelecimentoId}
                onChange={(event) =>
                  setEditEstabelecimentoId(Number.parseInt(event.target.value, 10) || '')
                }
                data-testid="mapeamento-edit-select"
              >
                {estabelecimentoOptions.map((est) => (
                  <option key={est.id} value={est.id}>
                    {est.codigo_externo} · {est.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="cadastro-form-actions">
              <button
                type="button"
                className="cadastro-btn ghost"
                onClick={() => setEditTarget(null)}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cadastro-btn"
                onClick={() => void handleSaveEdit()}
                disabled={busy || editEstabelecimentoId === ''}
                data-testid="mapeamento-edit-save"
              >
                {busy ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
