import { Outlet, useLocation } from 'react-router-dom';
import { resolveRouteMeta } from '../../config/navigation';
import { useApp } from '../../contexts/AppContext';
import { SituacaoOverlay } from '../../pages/Situacao';
import { Logo } from '../Logo';
import { FilterBar } from './FilterBar';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  const location = useLocation();
  const { isSituacao } = useApp();
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

      {isSituacao ? <SituacaoOverlay /> : null}
    </div>
  );
}
