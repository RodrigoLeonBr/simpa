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
import { useState } from 'react';
import { LayoutA } from './LayoutA';
import { LayoutB } from './LayoutB';
import { LayoutC } from './LayoutC';

export default function PainelPage() {
  const { competencia, painelPerfil, setPainelPerfil } = useFilters();
  const { data, unidades, loading, error } = useDashboard();
  const [layout, setLayout] = useState<PainelLayout>('A');
  const catalogReady = isPainelCatalogReady(painelPerfil, layout);

  if (loading && catalogReady) {
    return <div className="painel-state">Carregando painel…</div>;
  }

  if (catalogReady && (error || !data)) {
    return <div className="painel-state painel-state-error">{error ?? 'Painel indisponível'}</div>;
  }

  const moduleStatuses = data ? buildModuleStatuses(data) : [];

  return (
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
  );
}
