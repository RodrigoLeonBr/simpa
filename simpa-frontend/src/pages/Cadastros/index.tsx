import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/cadastros', end: true, label: 'Unidades' },
  { to: '/cadastros/procedimentos', end: false, label: 'Procedimentos (e-SUS ↔ SIGTAP)' },
];

export default function CadastrosLayout() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-dark-900 border-b border-dark-600 px-4 py-1.5 flex gap-2 shrink-0">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              `px-3 py-1 text-[11px] rounded-md transition-colors ${
                isActive
                  ? 'bg-blue-900/50 text-sky-300 font-semibold'
                  : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
