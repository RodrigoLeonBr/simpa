import type { NavIconKey } from '../config/navigation';

interface NavIconProps {
  name: NavIconKey;
  active?: boolean;
}

export function NavIcon({ name, active = false }: NavIconProps) {
  const color = active ? '#fff' : '#6f86a3';

  switch (name) {
    case 'painel':
      return (
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <rect x="0" y="0" width="6.5" height="6.5" rx="1.5" fill={color} />
          <rect x="8.5" y="0" width="6.5" height="6.5" rx="1.5" fill={color} />
          <rect x="0" y="8.5" width="6.5" height="6.5" rx="1.5" fill={color} />
          <rect x="8.5" y="8.5" width="6.5" height="6.5" rx="1.5" fill={color} />
        </svg>
      );
    case 'cadastros':
      return (
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <rect x="0" y="1" width="15" height="2.4" rx="1.2" fill={color} />
          <rect x="0" y="6.3" width="15" height="2.4" rx="1.2" fill={color} />
          <rect x="0" y="11.6" width="15" height="2.4" rx="1.2" fill={color} />
        </svg>
      );
    case 'importacao':
      return (
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <polygon points="7.5,0 12,5.5 9.5,5.5 9.5,10 5.5,10 5.5,5.5 3,5.5" fill={color} />
          <rect x="1" y="12.5" width="13" height="2.2" rx="1.1" fill={color} />
        </svg>
      );
    case 'metas':
      return (
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <circle cx="7.5" cy="7.5" r="6.5" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="7.5" cy="7.5" r="2.2" fill={color} />
        </svg>
      );
    case 'indicadores':
      return (
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <rect x="0" y="8" width="3.5" height="7" rx="1" fill={color} />
          <rect x="5.7" y="4" width="3.5" height="11" rx="1" fill={color} />
          <rect x="11.5" y="0" width="3.5" height="15" rx="1" fill={color} />
        </svg>
      );
    case 'relatorios':
      return (
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <rect x="1.5" y="0" width="12" height="15" rx="2" fill="none" stroke={color} strokeWidth="1.8" />
          <rect x="4" y="3.5" width="7" height="1.6" rx="0.8" fill={color} />
          <rect x="4" y="6.7" width="7" height="1.6" rx="0.8" fill={color} />
          <rect x="4" y="9.9" width="4.5" height="1.6" rx="0.8" fill={color} />
        </svg>
      );
    case 'admin':
      return (
        <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
          <circle cx="7.5" cy="7.5" r="6.2" fill="none" stroke={color} strokeWidth="1.8" />
          <circle cx="7.5" cy="7.5" r="2" fill={color} />
        </svg>
      );
    default:
      return null;
  }
}
