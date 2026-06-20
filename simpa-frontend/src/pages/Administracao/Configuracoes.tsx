import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { fetchConfiguracoes, updateConfiguracoes } from '../../api/admin';
import { DEFAULT_COMPETENCIAS } from '../../config/navigation';
import { COMPETENCIA_PADRAO_CHAVE } from '../../types/admin';
import { ToastBanner, useToast } from '../../components/shared/Toast';

export function ConfiguracoesPage() {
  const [competencia, setCompetencia] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchConfiguracoes();
      const found = rows.find((row) => row.chave === COMPETENCIA_PADRAO_CHAVE);
      setCompetencia(found?.valor ?? DEFAULT_COMPETENCIAS[0] ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar configurações');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!competencia) return;

    setSaving(true);
    try {
      await updateConfiguracoes([
        {
          chave: COMPETENCIA_PADRAO_CHAVE,
          valor: competencia,
          descricao: 'Competência padrão ao abrir o painel',
        },
      ]);
      showToast('Configurações salvas');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cadastro-crud-page" data-testid="admin-config-page">
      <div>
        <h2 className="analytics-title">Configurações Gerais</h2>
        <p className="analytics-subtitle">Parâmetros globais do sistema</p>
      </div>

      {loading ? (
        <div className="analytics-state">Carregando configurações…</div>
      ) : error ? (
        <div className="analytics-state analytics-state-error">{error}</div>
      ) : (
        <form className="admin-config-form card" onSubmit={(e) => void handleSubmit(e)}>
          <label htmlFor="competencia-padrao">Competência padrão</label>
          <select
            id="competencia-padrao"
            value={competencia}
            onChange={(event) => setCompetencia(event.target.value)}
            data-testid="competencia-padrao-select"
          >
            {DEFAULT_COMPETENCIAS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <p className="admin-config-hint">
            Competência inicial exibida nos filtros do painel e relatórios.
          </p>
          <button type="submit" className="cadastro-btn primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      )}

      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
