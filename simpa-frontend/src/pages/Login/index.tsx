import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username.trim(), senha);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page" data-testid="login-page">
      <div className="login-left">
        <div className="login-left-glow" />
        <div className="login-brand">
          <div className="login-logo">S</div>
          <div>
            <div className="login-brand-title">SIMPA</div>
            <div className="login-brand-subtitle">Inteligência em Saúde · Americana/SP</div>
          </div>
        </div>

        <div className="login-left-content">
          <div className="login-kicker">Unidade de Planejamento</div>
          <h1 className="login-headline">Decisões em saúde orientadas a dados.</h1>
          <p className="login-description">
            Produção da APS, desfechos hospitalares, metas regulamentadas e benchmarking entre
            unidades — em uma só plataforma.
          </p>
        </div>

        <div className="login-stats mono">
          <div>
            <span className="login-stat-value">42</span>
            <br />
            equipes APS
          </div>
          <div>
            <span className="login-stat-value">11</span>
            <br />
            unidades
          </div>
          <div>
            <span className="login-stat-value">~240k</span>
            <br />
            habitantes
          </div>
        </div>
      </div>

      <div className="login-right">
        <form className="login-form" onSubmit={handleSubmit} data-testid="login-form">
          <div className="login-form-kicker">Acesso restrito</div>
          <h2 className="login-form-title">Entrar na plataforma</h2>
          <p className="login-form-subtitle">Use suas credenciais institucionais.</p>

          <div className="login-fields">
            <label className="login-field">
              <span>Usuário</span>
              <input
                className="login-input mono"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                data-testid="login-username"
              />
            </label>

            <label className="login-field">
              <span>Senha</span>
              <input
                className="login-input"
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                autoComplete="current-password"
                required
                data-testid="login-password"
              />
            </label>

            {error ? <div className="login-error">{error}</div> : null}

            <button type="submit" className="login-submit" disabled={loading} data-testid="login-submit">
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </div>

          <div className="login-footer">
            Ambiente protegido · LGPD · Auditoria de acessos ativa.
            <br />
            Prefeitura Municipal de Americana · Secretaria de Saúde
          </div>
        </form>
      </div>
    </div>
  );
}
