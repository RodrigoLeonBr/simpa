import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchGrupos,
  fetchPopulacao,
  upsertPopulacao,
  type PopulacaoAlvo,
  type VacinaGrupo,
} from '../../api/vacina';

export function VacinaPopulacaoPage() {
  const [rows, setRows] = useState<PopulacaoAlvo[]>([]);
  const [grupos, setGrupos] = useState<VacinaGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ano, setAno] = useState('2026');
  const [formGrupoId, setFormGrupoId] = useState('');
  const [formPop, setFormPop] = useState('');
  const [saving, setSaving] = useState(false);

  async function load(a: string) {
    setLoading(true);
    setError(null);
    try {
      const [r, g] = await Promise.all([fetchPopulacao(a ? Number(a) : undefined), fetchGrupos()]);
      setRows(r);
      setGrupos(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar população');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(ano); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAnoChange(val: string) {
    setAno(val);
    await load(val);
  }

  async function handleUpsert(e: React.FormEvent) {
    e.preventDefault();
    if (!formGrupoId || !formPop) return;
    setSaving(true);
    try {
      await upsertPopulacao({ ano: Number(ano), grupo_id: Number(formGrupoId), populacao: Number(formPop) });
      setFormGrupoId(''); setFormPop('');
      await load(ano);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar população');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cadastro-page simpa-rise" data-testid="vacina-populacao-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">← Cadastros</Link>
          <h2 className="analytics-title">Vacinas — População Alvo</h2>
          <p className="analytics-subtitle">População alvo por grupo etário e ano.</p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Ano
          <input
            type="number"
            value={ano}
            onChange={(e) => void handleAnoChange(e.target.value)}
            style={{ width: '5rem' }}
            aria-label="Ano"
          />
        </label>
      </div>

      {error && <div className="analytics-state analytics-state-error">{error}</div>}

      <section className="card cadastro-crud-card">
        {loading ? (
          <div className="analytics-state">Carregando população…</div>
        ) : (
          <table className="cadastro-table">
            <thead>
              <tr>
                <th>Grupo</th><th>Ano</th><th>População</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.grupo_nome}</td>
                  <td>{r.ano}</td>
                  <td>{r.populacao.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} style={{ textAlign: 'center' }}>Nenhum registro para {ano}.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="card cadastro-crud-card">
        <h3 className="analytics-subtitle" style={{ marginBottom: '0.75rem' }}>Definir / atualizar população</h3>
        <form onSubmit={(e) => void handleUpsert(e)} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            Grupo *
            <select required value={formGrupoId} onChange={(e) => setFormGrupoId(e.target.value)} aria-label="Grupo">
              <option value="">Selecione…</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            População *
            <input
              type="number"
              required
              min={0}
              value={formPop}
              onChange={(e) => setFormPop(e.target.value)}
              aria-label="População"
              style={{ width: '8rem' }}
            />
          </label>
          <button type="submit" className="cadastro-btn primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      </section>
    </section>
  );
}
