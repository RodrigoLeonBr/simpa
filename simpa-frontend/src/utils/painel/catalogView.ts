import type { PainelCatalogStatus, PainelPerfil, PainelViewContext } from '../../types/painel';
import type { PainelLayout } from './types';

export const PAINEL_KPI_CATALOGS: Record<
  PainelPerfil,
  Record<PainelLayout, PainelCatalogStatus>
> = {
  APS: { A: 'ready', B: 'ready', C: 'ready' },
  MAC: { A: 'pending', B: 'pending', C: 'pending' },
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
