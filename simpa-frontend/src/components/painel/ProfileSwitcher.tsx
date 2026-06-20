import type { PainelPerfil } from '../../types/painel';

interface ProfileSwitcherProps {
  perfil: PainelPerfil;
  onChange: (perfil: PainelPerfil) => void;
}

const OPTIONS: Array<{ id: PainelPerfil; label: string }> = [
  { id: 'APS', label: 'APS' },
  { id: 'MAC', label: 'MAC' },
  { id: 'Hospitalar', label: 'Hospitalar' },
  { id: 'Misto', label: 'Misto' },
];

export function ProfileSwitcher({ perfil, onChange }: ProfileSwitcherProps) {
  return (
    <div className="painel-layout-switcher painel-profile-switcher" role="group" aria-label="Perfil do painel">
      <span className="painel-layout-label">Perfil</span>
      <div className="painel-layout-options">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`painel-layout-btn${perfil === option.id ? ' active' : ''}`}
            aria-pressed={perfil === option.id}
            data-testid={`profile-switch-${option.id.toLowerCase()}`}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
