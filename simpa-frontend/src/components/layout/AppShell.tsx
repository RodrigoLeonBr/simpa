import { NavLink, Outlet } from 'react-router-dom';
import { getStoredTheme, toggleTheme } from '../../utils/theme';
import { useState } from 'react';

const navItems = [
  { to: '/', label: 'Painel', end: true },
  { to: '/cadastros', label: 'Cadastros' },
  { to: '/importacao', label: 'Importação' },
  { to: '/metas', label: 'Metas' },
  { to: '/indicadores', label: 'Indicadores' },
  { to: '/relatorios', label: 'Relatórios' },
  { to: '/admin', label: 'Administração' },
];

export function AppShell() {
  const [theme, setThemeState] = useState(getStoredTheme);

  function handleToggleTheme() {
    setThemeState(toggleTheme());
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">S</div>
          <div>
            <div className="sidebar-title">SIMPA</div>
            <div className="sidebar-subtitle">Americana/SP</div>
          </div>
        </div>

        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <button type="button" className="btn-ghost" onClick={handleToggleTheme}>
            Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}
          </button>
          <div className="mono" style={{ marginTop: 12, fontSize: 10.5, color: 'var(--text-muted)' }}>
            v0.1 · Fase 1
          </div>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>SIMPA — Monitoramento e Planejamento</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Shell de desenvolvimento</div>
          </div>
          <button type="button" className="btn-primary" onClick={handleToggleTheme}>
            Alternar tema
          </button>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
