import type { ModuleStatus, PainelLayout } from '../../utils/dashboardView';

interface LayoutSwitcherProps {
  layout: PainelLayout;
  onChange: (layout: PainelLayout) => void;
}

const OPTIONS: Array<{ id: PainelLayout; label: string }> = [
  { id: 'A', label: 'A · Cards' },
  { id: 'B', label: 'B · Foco' },
  { id: 'C', label: 'C · Tabela' },
];

export function LayoutSwitcher({ layout, onChange }: LayoutSwitcherProps) {
  return (
    <div className="painel-layout-switcher" role="group" aria-label="Layout do painel">
      <span className="painel-layout-label">Layout</span>
      <div className="painel-layout-options">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`painel-layout-btn${layout === option.id ? ' active' : ''}`}
            aria-pressed={layout === option.id}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ModuleStatusBarProps {
  statuses: ModuleStatus[];
}

export function ModuleStatusBar({ statuses }: ModuleStatusBarProps) {
  return (
    <div className="module-status-bar">
      {statuses.map((item) => (
        <div key={item.id} className={`module-status-card tone-${item.tone}`}>
          <div className="module-status-title">{item.label}</div>
          <span className="module-status-badge mono">{item.status}</span>
        </div>
      ))}
    </div>
  );
}
