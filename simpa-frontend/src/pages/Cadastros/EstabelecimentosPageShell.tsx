import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EstabelecimentosPageShellProps {
  children: ReactNode;
}

export function EstabelecimentosPageShell({ children }: EstabelecimentosPageShellProps) {
  return (
    <div className="cadastro-page simpa-rise" data-testid="estabelecimentos-page">
      <div className="cadastro-crud-head">
        <div>
          <Link to="/cadastros" className="cadastro-back-link">
            ← Cadastros
          </Link>
          <h2 className="analytics-title">Estabelecimentos</h2>
          <p className="analytics-subtitle">
            Espelho unificado de prestadores — campos SIA bloqueados; perfil e enriquecimento
            editáveis para equipe de planejamento.
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
