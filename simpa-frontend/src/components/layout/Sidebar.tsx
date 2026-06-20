import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/navigation';
import { useApp } from '../../contexts/AppContext';
import { NavIcon } from '../NavIcon';

export function Sidebar() {
  const { theme, toggleAppTheme } = useApp();

  return (
    <nav className="sidebar-nav" aria-label="Módulos">
      <div className="sidebar-section-label">MÓDULOS</div>

      {NAV_ITEMS.map((item) => (
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
              {item.badge ? <span className="sidebar-nav-badge mono">{item.badge}</span> : null}
            </>
          )}
        </NavLink>
      ))}

      <div className="sidebar-footer">
        <button type="button" className="sidebar-theme-toggle" onClick={toggleAppTheme}>
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
