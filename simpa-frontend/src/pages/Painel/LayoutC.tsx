import type { ContratoDashboard, Unidade } from '../../types/contrato';
import { buildPainelKpis, buildUnitTable } from '../../utils/dashboardView';
import { KpiCard } from '../../components/painel/KpiCard';

interface LayoutCProps {
  data: ContratoDashboard;
  unidades: Unidade[];
}

export function LayoutC({ data, unidades }: LayoutCProps) {
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
