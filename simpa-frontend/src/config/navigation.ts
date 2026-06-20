export interface NavItem {
  to: string;
  label: string;
  icon: NavIconKey;
  end?: boolean;
  badge?: string;
}

export type NavIconKey =
  | 'painel'
  | 'cadastros'
  | 'importacao'
  | 'metas'
  | 'indicadores'
  | 'relatorios'
  | 'admin';

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Painel', icon: 'painel', end: true },
  { to: '/cadastros', label: 'Cadastros', icon: 'cadastros' },
  { to: '/importacao', label: 'Importação', icon: 'importacao', badge: '2' },
  { to: '/metas', label: 'Metas', icon: 'metas' },
  { to: '/indicadores', label: 'Indicadores', icon: 'indicadores' },
  { to: '/relatorios', label: 'Relatórios', icon: 'relatorios' },
  { to: '/admin', label: 'Administração', icon: 'admin' },
];

export interface RouteMeta {
  title: string;
  crumb: string;
  showFilters: boolean;
}

const ROUTE_META: Record<string, RouteMeta> = {
  '/': { title: 'Painel', crumb: 'Dashboard', showFilters: true },
  '/cadastros': { title: 'Cadastros', crumb: 'CRUD', showFilters: false },
  '/importacao': { title: 'Importação', crumb: 'Histórico de Cargas', showFilters: false },
  '/metas': { title: 'Metas', crumb: 'Acompanhamento', showFilters: true },
  '/indicadores': { title: 'Indicadores', crumb: 'Painel de Indicadores', showFilters: true },
  '/relatorios': { title: 'Relatórios', crumb: 'Comparativo entre Unidades', showFilters: true },
  '/admin': { title: 'Administração', crumb: 'Usuários e Perfis', showFilters: false },
};

export function resolveRouteMeta(pathname: string): RouteMeta {
  if (pathname.startsWith('/cadastros')) {
    return ROUTE_META['/cadastros']!;
  }

  return ROUTE_META[pathname] ?? ROUTE_META['/']!;
}

export const DEFAULT_COMPETENCIAS = ['2026-05', '2026-04', '2026-03', '2026-02', '2026-01'];
