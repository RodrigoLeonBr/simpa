import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchFaixaGrupo,
  fetchGrupos,
  setFaixaGrupo,
  type FaixaGrupo,
  type VacinaGrupo,
} from '../../api/vacina';

export function VacinaFaixaGrupoPage() {
  const [faixas, setFaixas] = useState<FaixaGrupo[]>([]);
  const [grupos, setGrupos] = useState<VacinaGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [f, g] = await Promise.all([fetchFaixaGrupo(), fetchGrupos()]);
      setFaixas(f);
      setGrupos(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar faixas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleChange(faixa: string, value: string) {
    try {
      await setFaixaGrupo(faixa, value ? Number(value) : null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar de-para');
    }
  }

  return (
    <section className="cadastro-page simpa-rise" data-testid="vacina-faixa-grupo-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">← Cadastros</Link>
          <h2 className="analytics-title">Vacinas — Faixas → Grupo</h2>
          <p className="analytics-subtitle">De-para faixa etária NIES → grupo etário.</p>
        </div>
      </div>

      {error && <div className="analytics-state analytics-state-error">{error}</div>}

      <section className="card cadastro-crud-card">
        {loading ? (
          <div className="analytics-state">Carregando faixas…</div>
        ) : (
          <table className="cadastro-table">
            <thead>
              <tr>
                <th>Faixa NIES</th><th>Grupo</th>
              </tr>
            </thead>
            <tbody>
              {faixas.map((f) => (
                <tr key={f.faixa_nies}>
                  <td className="mono">{f.faixa_nies}</td>
                  <td>
                    <label htmlFor={`faixa-${f.faixa_nies}`} className="sr-only">
                      Grupo para {f.faixa_nies}
                    </label>
                    <select
                      id={`faixa-${f.faixa_nies}`}
                      value={f.grupo_id ?? ''}
                      onChange={(e) => void handleChange(f.faixa_nies, e.target.value)}
                    >
                      <option value="">— sem grupo —</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>{g.nome}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
