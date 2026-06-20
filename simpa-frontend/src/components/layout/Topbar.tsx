import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';

interface TopbarProps {
  title: string;
  crumb: string;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export function Topbar({ title, crumb }: TopbarProps) {
  const { user, logout } = useAuth();
  const { openSituacao } = useApp();

  const displayName = user?.nome ?? 'Usuário';
  const displayPerfil = user?.perfil ?? 'Perfil';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">{title}</h1>
        <span className="topbar-crumb">/ {crumb}</span>
      </div>

      <div className="topbar-right">
        <button type="button" className="topbar-situacao-btn" onClick={openSituacao}>
          ▣ Sala de Situação
        </button>
        <div className="topbar-divider" />
        <div className="topbar-profile">
          <div className="topbar-avatar mono">{initialsFromName(displayName)}</div>
          <div className="topbar-profile-text">
            <div className="topbar-profile-name">{displayName}</div>
            <div className="topbar-profile-role">{displayPerfil}</div>
          </div>
        </div>
        <button
          type="button"
          className="topbar-logout-btn"
          title="Sair"
          onClick={() => logout()}
        >
          ⏻
        </button>
      </div>
    </header>
  );
}
