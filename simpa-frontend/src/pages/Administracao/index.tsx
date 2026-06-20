import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  canAccessAdminModule,
  canManageAdminUsers,
  canReadAuditLog,
} from '../../utils/adminView';
import { AuditLogPage } from './AuditLog';
import { ConfiguracoesPage } from './Configuracoes';
import { UsuariosPage } from './Usuarios';

function AdminSubNav() {
  const { user } = useAuth();
  const perfil = user?.perfil;
  const showUsers = canManageAdminUsers(perfil);
  const showAudit = canReadAuditLog(perfil);

  return (
    <nav className="admin-subnav" aria-label="Administração" data-testid="admin-subnav">
      {showUsers ? (
        <NavLink
          to="/admin/usuarios"
          className={({ isActive }) => `admin-subnav-link${isActive ? ' active' : ''}`}
        >
          Usuários
        </NavLink>
      ) : null}
      {showAudit ? (
        <NavLink
          to="/admin/auditoria"
          className={({ isActive }) => `admin-subnav-link${isActive ? ' active' : ''}`}
        >
          Auditoria
        </NavLink>
      ) : null}
      {showUsers ? (
        <NavLink
          to="/admin/configuracoes"
          className={({ isActive }) => `admin-subnav-link${isActive ? ' active' : ''}`}
        >
          Configurações
        </NavLink>
      ) : null}
    </nav>
  );
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!canManageAdminUsers(user?.perfil)) {
    return <Navigate to="/admin/auditoria" replace />;
  }
  return <>{children}</>;
}

export default function AdminPage() {
  const { user } = useAuth();

  if (!canAccessAdminModule(user?.perfil)) {
    return <Navigate to="/" replace />;
  }

  const defaultRoute = canManageAdminUsers(user?.perfil) ? 'usuarios' : 'auditoria';

  return (
    <div className="admin-page cadastro-page simpa-rise" data-testid="admin-page">
      <div className="analytics-header">
        <h1 className="analytics-title">Administração</h1>
        <p className="analytics-subtitle">Usuários, auditoria e parâmetros do sistema</p>
      </div>

      <AdminSubNav />

      <Routes>
        <Route index element={<Navigate to={defaultRoute} replace />} />
        <Route
          path="usuarios"
          element={
            <AdminOnly>
              <UsuariosPage />
            </AdminOnly>
          }
        />
        <Route path="auditoria" element={<AuditLogPage />} />
        <Route
          path="configuracoes"
          element={
            <AdminOnly>
              <ConfiguracoesPage />
            </AdminOnly>
          }
        />
        <Route path="*" element={<Navigate to={defaultRoute} replace />} />
      </Routes>
    </div>
  );
}
