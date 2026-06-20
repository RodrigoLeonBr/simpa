import { Outlet, useLocation } from 'react-router-dom';
import { resolveRouteMeta } from '../../config/navigation';
import { useApp } from '../../contexts/AppContext';
import { Logo } from '../Logo';
import { FilterBar } from './FilterBar';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  const location = useLocation();
  const { isSituacao, closeSituacao } = useApp();
  const meta = resolveRouteMeta(location.pathname);

  return (
    <div className="app-shell-grid">
      <div className="shell-brand">
        <Logo size={32} />
        <div>
          <div className="shell-brand-title">SIMPA</div>
          <div className="shell-brand-subtitle">Americana/SP</div>
        </div>
      </div>

      <Topbar title={meta.title} crumb={meta.crumb} />
      <Sidebar />

      <div className="main-panel">
        {meta.showFilters ? <FilterBar /> : null}
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {isSituacao ? (
        <div className="situacao-overlay" role="dialog" aria-modal="true" aria-label="Sala de Situação">
          <div className="situacao-overlay-content">
            <h2>Sala de Situação</h2>
            <p>Overlay fullscreen será implementado na task 13.</p>
            <button type="button" className="btn-primary" onClick={closeSituacao}>
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
