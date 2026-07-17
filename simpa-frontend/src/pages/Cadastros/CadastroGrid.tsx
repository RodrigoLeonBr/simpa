import { Link } from 'react-router-dom';
import { CADASTRO_GRID_ITEMS, cadastroGridTestId } from '../../config/cadastroEntities';

export function CadastroGrid() {
  return (
    <div className="cadastro-page simpa-rise" data-testid="cadastro-grid-page">
      <div className="analytics-header">
        <h2 className="analytics-title">Cadastros</h2>
        <p className="analytics-subtitle">
          Espelho SIA + cadastros manuais · equipes e emendas editáveis
        </p>
      </div>

      <div className="cadastro-grid">
        {CADASTRO_GRID_ITEMS.map((item) => {
          const testId = cadastroGridTestId(item.route);

          if (item.external) {
            return (
              <Link
                key={item.route}
                to={item.route}
                className="cadastro-card"
                data-testid={testId}
              >
                <div className="cadastro-card-head">
                  <div className="cadastro-card-title">{item.title}</div>
                  <span className="mono cadastro-card-table">{item.tableName}</span>
                </div>
                <p className="cadastro-card-desc">{item.description}</p>
                <span className="cadastro-card-cta">Abrir administração →</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.route}
              to={`/cadastros/${item.route}`}
              className="cadastro-card"
              data-testid={testId}
            >
              <div className="cadastro-card-head">
                <div className="cadastro-card-title">{item.title}</div>
                <span className="mono cadastro-card-table">{item.tableName}</span>
              </div>
              <p className="cadastro-card-desc">{item.description}</p>
              <span className="cadastro-card-cta">Abrir cadastro →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
