import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createGrupo,
  fetchGrupos,
  updateGrupo,
  type VacinaGrupo,
} from '../../api/vacina';

export function VacinaGruposPage() {
  const [grupos, setGrupos] = useState<VacinaGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [ordem, setOrdem] = useState('');
  const [saving, setSaving] = useState(false);

  // inline edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editOrdem, setEditOrdem] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setGrupos(await fetchGrupos());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar grupos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createGrupo({ nome: nome.trim(), slug: slug.trim(), ordem: ordem ? Number(ordem) : undefined });
      setNome(''); setSlug(''); setOrdem('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao criar grupo');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(g: VacinaGrupo) {
    setEditId(g.id);
    setEditNome(g.nome);
    setEditOrdem(String(g.ordem));
  }

  async function handleEditSave(g: VacinaGrupo) {
    try {
      await updateGrupo(g.id, { nome: editNome.trim(), ordem: editOrdem ? Number(editOrdem) : g.ordem });
      setEditId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar grupo');
    }
  }

  async function toggleAtivo(g: VacinaGrupo) {
    try {
      await updateGrupo(g.id, { ativo: !g.ativo });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao alterar status');
    }
  }

  return (
    <section className="cadastro-page simpa-rise" data-testid="vacina-grupos-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">← Cadastros</Link>
          <h2 className="analytics-title">Vacinas — Grupos Etários</h2>
          <p className="analytics-subtitle">Grupos etários alvo para cobertura vacinal.</p>
        </div>
      </div>

      {error && <div className="analytics-state analytics-state-error">{error}</div>}

      <section className="card cadastro-crud-card">
        {loading ? (
          <div className="analytics-state">Carregando grupos…</div>
        ) : (
          <table className="cadastro-table">
            <thead>
              <tr>
                <th>Nome</th><th>Slug</th><th>Ordem</th><th>Ativo</th><th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) =>
                editId === g.id ? (
                  <tr key={g.id}>
                    <td>
                      <input value={editNome} onChange={(e) => setEditNome(e.target.value)} aria-label="Nome" />
                    </td>
                    <td className="mono">{g.slug}</td>
                    <td>
                      <input type="number" value={editOrdem} onChange={(e) => setEditOrdem(e.target.value)} aria-label="Ordem" style={{ width: '4rem' }} />
                    </td>
                    <td>{g.ativo ? 'Sim' : 'Não'}</td>
                    <td>
                      <button type="button" className="cadastro-btn primary" onClick={() => void handleEditSave(g)}>Salvar</button>
                      <button type="button" className="cadastro-btn" onClick={() => setEditId(null)}>Cancelar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={g.id}>
                    <td>{g.nome}</td>
                    <td className="mono">{g.slug}</td>
                    <td>{g.ordem}</td>
                    <td>{g.ativo ? 'Sim' : 'Não'}</td>
                    <td>
                      <button type="button" className="cadastro-btn" onClick={() => startEdit(g)}>Editar</button>
                      <button type="button" className="cadastro-btn" onClick={() => void toggleAtivo(g)}>
                        {g.ativo ? 'Inativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="card cadastro-crud-card">
        <h3 className="analytics-subtitle" style={{ marginBottom: '0.75rem' }}>Novo grupo</h3>
        <form onSubmit={(e) => void handleCreate(e)} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            Nome *
            <input required value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            Slug *
            <input required value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Slug" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            Ordem
            <input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} aria-label="Ordem" style={{ width: '5rem' }} />
          </label>
          <button type="submit" className="cadastro-btn primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Criar grupo'}
          </button>
        </form>
      </section>
    </section>
  );
}
