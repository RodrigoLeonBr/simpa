import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/navigation';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { useImportBadge } from '../../hooks/useImportBadge';
import { canAccessAdminModule } from '../../utils/adminView';
import { NavIcon } from '../NavIcon';

export function Sidebar() {
  const { theme, toggleAppTheme } = useApp();
  const { user } = useAuth();
  const pendingImports = useImportBadge();
  const navItems = NAV_ITEMS.filter(
    (item) => item.to !== '/admin' || canAccessAdminModule(user?.perfil),
  );

  return (
    <nav className="sidebar-nav" aria-label="Módulos">
      <div className="sidebar-section-label">MÓDULOS</div>

      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
        >
          {({ isActive }) => (
            <>
              <span className="sidebar-nav-icon">
                <NavIcon name={item.icon} active={isActive} />
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.to === '/importacao' && pendingImports > 0 ? (
                <span className="sidebar-nav-badge mono">{pendingImports}</span>
              ) : item.badge ? (
                <span className="sidebar-nav-badge mono">{item.badge}</span>
              ) : null}
            </>
          )}
        </NavLink>
      ))}

      <div className="sidebar-footer">
        <button type="button" className="sidebar-theme-toggle" onClick={toggleAppTheme} data-testid="sidebar-theme-toggle">
          {theme === 'dark' ? '☀ Tema claro' : '☾ Tema escuro'}
        </button>
        <div className="sidebar-version mono">
          v0.1 · Fase 1
          <br />
          ETL e-SUS · SIA · SIHD
        </div>
      </div>
    </nav>
  );
}
