import { useFilters } from '../../hooks/useFilters';
import { useDashboard } from '../../hooks/useDashboard';
import {
  buildModuleStatuses,
  isPainelCatalogReady,
  type PainelLayout,
} from '../../utils/dashboardView';
import { LayoutSwitcher, ModuleStatusBar } from '../../components/painel/LayoutSwitcher';
import { PainelProfilePlaceholder } from '../../components/painel/PainelProfilePlaceholder';
import { ProfileSwitcher } from '../../components/painel/ProfileSwitcher';
import { DashboardPageShell } from '../../components/shared/DashboardPageShell';
import { useState } from 'react';
import { LayoutA } from './LayoutA';
import { LayoutB } from './LayoutB';
import { LayoutC } from './LayoutC';

export default function PainelPage() {
  const { competencia, painelPerfil, setPainelPerfil } = useFilters();
  const { data, unidades, loading, error } = useDashboard();
  const [layout, setLayout] = useState<PainelLayout>('A');
  const catalogReady = isPainelCatalogReady(painelPerfil, layout);
  const shellLoading = catalogReady && loading;
  const shellError =
    catalogReady && (error || !data) ? (error ?? 'Painel indisponível') : null;

  const moduleStatuses = data ? buildModuleStatuses(data) : [];

  return (
    <DashboardPageShell loading={shellLoading} error={shellError} loadingLabel="Carregando painel…">
      {() => (
      <div className="painel-page simpa-rise" data-testid="painel-page">
        <div className="painel-header">
          <div>
            <h2 className="painel-title">Painel gerencial</h2>
            <p className="painel-subtitle">
              Visão município · perfil {painelPerfil} · competência {competencia}
            </p>
          </div>
          <div className="painel-switchers">
            <ProfileSwitcher perfil={painelPerfil} onChange={setPainelPerfil} />
            <LayoutSwitcher layout={layout} onChange={setLayout} />
          </div>
        </div>

        {catalogReady && data ? (
          <>
            {layout === 'A' ? <LayoutA data={data} unidades={unidades} /> : null}
            {layout === 'B' ? <LayoutB data={data} unidades={unidades} /> : null}
            {layout === 'C' ? <LayoutC data={data} unidades={unidades} /> : null}
          </>
        ) : (
          <PainelProfilePlaceholder perfil={painelPerfil} unidadesCount={unidades.length} />
        )}

        {catalogReady && data ? <ModuleStatusBar statuses={moduleStatuses} /> : null}
      </div>
      )}
    </DashboardPageShell>
  );
}
