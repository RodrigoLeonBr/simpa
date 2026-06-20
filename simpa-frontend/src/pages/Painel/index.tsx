import { useState } from 'react';
import { useFilters } from '../../hooks/useFilters';
import { useDashboard } from '../../hooks/useDashboard';
import { buildModuleStatuses, type PainelLayout } from '../../utils/dashboardView';
import { LayoutSwitcher, ModuleStatusBar } from '../../components/painel/LayoutSwitcher';
import { LayoutA } from './LayoutA';
import { LayoutB } from './LayoutB';
import { LayoutC } from './LayoutC';

export default function PainelPage() {
  const { competencia } = useFilters();
  const { data, unidades, loading, error } = useDashboard();
  const [layout, setLayout] = useState<PainelLayout>('A');

  if (loading) {
    return <div className="painel-state">Carregando painel…</div>;
  }

  if (error || !data) {
    return <div className="painel-state painel-state-error">{error ?? 'Painel indisponível'}</div>;
  }

  const moduleStatuses = buildModuleStatuses(data);

  return (
    <div className="painel-page simpa-rise" data-testid="painel-page">
      <div className="painel-header">
        <div>
          <h2 className="painel-title">Painel gerencial</h2>
          <p className="painel-subtitle">
            Visão município · modelo OCI Regional · competência {competencia}
          </p>
        </div>
        <LayoutSwitcher layout={layout} onChange={setLayout} />
      </div>

      {layout === 'A' ? <LayoutA data={data} unidades={unidades} /> : null}
      {layout === 'B' ? <LayoutB data={data} /> : null}
      {layout === 'C' ? <LayoutC data={data} unidades={unidades} /> : null}

      <ModuleStatusBar statuses={moduleStatuses} />
    </div>
  );
}
