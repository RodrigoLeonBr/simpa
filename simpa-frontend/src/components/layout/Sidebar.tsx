import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Upload, Target,
  BarChart2, FileText, Settings,
} from 'lucide-react';

const NAV = [
  { to: '/',              icon: LayoutDashboard, label: 'Painel' },
  { to: '/cadastros',     icon: Users,           label: 'Cadastros' },
  { to: '/importacao',    icon: Upload,          label: 'Importação' },
  { to: '/metas',         icon: Target,          label: 'Metas' },
  { to: '/indicadores',   icon: BarChart2,       label: 'Indicadores' },
  { to: '/relatorios',    icon: FileText,        label: 'Relatórios' },
];

export function Sidebar() {
  return (
    <div className="w-14 bg-dark-800 flex flex-col items-center py-3 gap-1 border-r border-dark-600 shrink-0">
      {/* Logo */}
      <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center mb-2">
        <span className="text-white text-sm font-black">S</span>
      </div>

      {NAV.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          title={label}
          className={({ isActive }) =>
            `w-10 h-9 rounded-lg flex items-center justify-center transition-colors ${
              isActive
                ? 'bg-blue-900/50 text-sky-400'
                : 'text-dark-500 hover:text-slate-400 hover:bg-dark-700'
            }`
          }
        >
          <Icon size={18} />
        </NavLink>
      ))}

      <div className="flex-1" />

      <NavLink
        to="/admin"
        title="Administração"
        className={({ isActive }) =>
          `w-10 h-9 rounded-lg flex items-center justify-center transition-colors ${
            isActive ? 'bg-blue-900/50 text-sky-400' : 'text-dark-500 hover:text-slate-400'
          }`
        }
      >
        <Settings size={18} />
      </NavLink>
    </div>
  );
}
