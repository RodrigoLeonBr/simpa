import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteEsquema,
  fetchEsquema,
  fetchGrupos,
  fetchImunobiologicos,
  upsertEsquema,
  type Esquema,
  type Imunobiologico,
  type VacinaGrupo,
} from '../../api/vacina';

export function VacinaEsquemaPage() {
  const [rows, setRows] = useState<Esquema[]>([]);
  const [grupos, setGrupos] = useState<VacinaGrupo[]>([]);
  const [imunis, setImunis] = useState<Imunobiologico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formImuno, setFormImuno] = useState('');
  const [formGrupo, setFormGrupo] = useState('');
  const [formDoses, setFormDoses] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [e, g, i] = await Promise.all([fetchEsquema(), fetchGrupos(), fetchImunobiologicos()]);
      setRows(e);
      setGrupos(g);
      setImunis(i);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar esquemas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleDelete(id: number) {
    try {
      await deleteEsquema(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir esquema');
    }
  }

  async function handleUpsert(e: React.FormEvent) {
    e.preventDefault();
    if (!formImuno || !formGrupo || !formDoses || Number(formDoses) < 1) return;
    setSaving(true);
    try {
      await upsertEsquema({ imuno_codigo: formImuno, grupo_id: Number(formGrupo), num_doses: Number(formDoses) });
      setFormImuno(''); setFormGrupo(''); setFormDoses('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar esquema');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="cadastro-page simpa-rise" data-testid="vacina-esquema-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">← Cadastros</Link>
          <h2 className="analytics-title">Vacinas — Esquema de Doses</h2>
          <p className="analytics-subtitle">Número de doses do esquema por vacina e grupo etário.</p>
        </div>
      </div>

      {error && <div className="analytics-state analytics-state-error">{error}</div>}

      <section className="card cadastro-crud-card">
        {loading ? (
          <div className="analytics-state">Carregando esquemas…</div>
        ) : (
          <table className="cadastro-table">
            <thead>
              <tr>
                <th>Imunobiológico</th><th>Grupo</th><th>Doses</th><th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.imuno_nome}</td>
                  <td>{r.grupo_nome}</td>
                  <td>{r.num_doses}</td>
                  <td>
                    <button
                      type="button"
                      className="cadastro-btn"
                      onClick={() => void handleDelete(r.id)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center' }}>Nenhum esquema cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="card cadastro-crud-card">
        <h3 className="analytics-subtitle" style={{ marginBottom: '0.75rem' }}>Adicionar / atualizar esquema</h3>
        <form onSubmit={(e) => void handleUpsert(e)} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            Imunobiológico *
            <select required value={formImuno} onChange={(e) => setFormImuno(e.target.value)} aria-label="Imunobiológico">
              <option value="">Selecione…</option>
              {imunis.map((i) => (
                <option key={i.imuno_codigo} value={i.imuno_codigo}>
                  {i.imuno_codigo} - {i.imuno_nome}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            Grupo *
            <select required value={formGrupo} onChange={(e) => setFormGrupo(e.target.value)} aria-label="Grupo">
              <option value="">Selecione…</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            Nº de doses *
            <input
              type="number"
              required
              min={1}
              value={formDoses}
              onChange={(e) => setFormDoses(e.target.value)}
              aria-label="Nº de doses"
              style={{ width: '5rem' }}
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
