import type { PainelCatalogStatus, PainelPerfil, PainelViewContext } from '../../types/painel';
import type { PainelLayout } from './types';

const DYNAMIC_PAINEL_PERFIS: PainelPerfil[] = ['APS', 'MAC', 'Hospitalar'];

export function isDynamicPainelPerfil(perfil: PainelPerfil): boolean {
  return DYNAMIC_PAINEL_PERFIS.includes(perfil);
}

export const PAINEL_KPI_CATALOGS: Record<
  PainelPerfil,
  Record<PainelLayout, PainelCatalogStatus>
> = {
  APS: { A: 'ready', B: 'ready', C: 'ready' },
  MAC: { A: 'ready', B: 'pending', C: 'pending' },
  Hospitalar: { A: 'ready', B: 'pending', C: 'pending' },
  Misto: { A: 'pending', B: 'pending', C: 'pending' },
};

export function getPainelCatalogStatus(
  perfil: PainelPerfil,
  layout?: PainelLayout,
): PainelCatalogStatus {
  if (layout) {
    return PAINEL_KPI_CATALOGS[perfil][layout];
  }

  return perfil === 'APS' ? 'ready' : 'pending';
}

export function resolvePainelViewContext(
  perfil: PainelPerfil,
  layout: PainelLayout,
): PainelViewContext {
  return {
    perfil,
    layout,
    catalogStatus: getPainelCatalogStatus(perfil, layout),
  };
}

export function isPainelCatalogReady(perfil: PainelPerfil, layout: PainelLayout = 'A'): boolean {
  return getPainelCatalogStatus(perfil, layout) === 'ready';
}

/** Layout A dinâmico (SIA/SIH/e-SUS via painel-layout) não depende de dados_consolidados. */
export function needsConsolidatedDashboard(
  perfil: PainelPerfil,
  layout: PainelLayout = 'A',
): boolean {
  if (!isPainelCatalogReady(perfil, layout)) {
    return false;
  }
  if (layout === 'A' && isDynamicPainelPerfil(perfil)) {
    return false;
  }
  return true;
}
