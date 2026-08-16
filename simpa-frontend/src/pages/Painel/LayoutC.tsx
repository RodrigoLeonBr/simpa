import type { ContratoDashboard, Unidade } from '../../types/contrato';
import { buildPainelKpis, buildUnitTable } from '../../utils/dashboardView';
import { KpiCard } from '../../components/painel/KpiCard';
import { usePainelLayout } from '../../hooks/usePainelLayout';
import { mapWidgetToKpi, mapWidgetToRanking, splitPainelWidgetsByTipo } from '../../utils/painelWidgetsView';
import type { ResolvedPainelWidget } from '../../types/painelWidgets';

interface LayoutCProps {
  data: ContratoDashboard | null;
  unidades: Unidade[];
}

export function LayoutC({ data, unidades }: LayoutCProps) {
  const { layout, loading } = usePainelLayout('C');
  const widgets = layout?.widgets ?? [];

  if (widgets.length) {
    return <TabelaDynamic widgets={widgets} loading={loading} competencia={layout?.competencia} />;
  }

  if (data) {
    return <UnitTable data={data} unidades={unidades} />;
  }

  return null;
}

function TabelaDynamic({
  widgets,
  loading,
  competencia,
}: {
  widgets: ResolvedPainelWidget[];
  loading: boolean;
  competencia?: string;
}) {
  const sorted = [...widgets].sort((a, b) => a.ordem - b.ordem || a.slug.localeCompare(b.slug));
  const { cards, rankings } = splitPainelWidgetsByTipo(sorted);

  return (
    <div className="painel-layout-c" data-testid="layout-c">
      {loading ? <p className="painel-state-inline">Atualizando indicadores dinâmicos…</p> : null}

      {cards.length ? (
        <div className="kpi-grid-6">
          {cards.map((widget) => (
            <KpiCard key={widget.slug} kpi={mapWidgetToKpi(widget)} compact />
          ))}
        </div>
      ) : null}

      {rankings.map((widget) => {
        const rows = mapWidgetToRanking(widget, { limit: 10 });
        return (
          <section key={widget.slug} className="card painel-table-card">
            <div className="painel-table-head">
              {widget.titulo}
              {competencia ? ` · competência ${competencia}` : ''}
            </div>
            <div className="painel-table-wrap">
              <table className="painel-table">
                <thead>
                  <tr>
                    <th>{widget.subtitulo || 'Categoria'}</th>
                    <th className="align-right">Internações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((row) => (
                      <tr key={row.nome}>
                        <td>{row.nome}</td>
                        <td className="mono align-right">{row.valueLabel}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2}>—</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function UnitTable({ data, unidades }: { data: ContratoDashboard; unidades: Unidade[] }) {
  const kpis = buildPainelKpis(data);
  const rows = buildUnitTable(data, unidades);

  return (
    <div className="painel-layout-c" data-testid="layout-c">
      <div className="kpi-grid-6">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} kpi={kpi} compact />
        ))}
      </div>

      <section className="card painel-table-card">
        <div className="painel-table-head">
          Desempenho por unidade · competência {data.competencia}
        </div>
        <div className="painel-table-wrap">
          <table className="painel-table">
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Tipo</th>
                <th className="align-right">Atend. ind.</th>
                <th className="align-right">Odonto</th>
                <th className="align-right">Cobertura</th>
                <th className="align-right">Metas</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.nome}>
                  <td>{row.nome}</td>
                  <td>
                    <span className="unit-type-badge">{row.tipo}</span>
                  </td>
                  <td className="mono align-right">{row.atendimentos}</td>
                  <td className="mono align-right">{row.odonto}</td>
                  <td className="mono align-right">{row.cobertura}</td>
                  <td className="mono align-right" style={{ color: row.metasColor, fontWeight: 600 }}>
                    {row.metas}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
