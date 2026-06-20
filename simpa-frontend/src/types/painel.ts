import type { PainelLayout } from '../utils/dashboardView';

export type PainelPerfil = 'APS' | 'MAC' | 'Hospitalar' | 'Misto';

export type PainelCatalogStatus = 'ready' | 'pending';

export interface PainelViewContext {
  perfil: PainelPerfil;
  layout: PainelLayout;
  catalogStatus: PainelCatalogStatus;
}
