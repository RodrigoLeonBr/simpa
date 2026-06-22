import type { ContratoDashboard, Unidade } from '../../types/contrato';
import { EM_DASH, formatKpi, isNullKpi } from '../kpi';
import { countMetasAtingidas, countMetasTotal } from './dashboardHelpers';
import type { UnitTableRow } from './types';

export function buildUnitTable(data: ContratoDashboard, unidades: Unidade[]): UnitTableRow[] {
  const activeUnit = data.filtros_ativos?.unidade;
  const metasAtingidas = countMetasAtingidas(data);
  const metasTotal = countMetasTotal(data);
  const metasText =
    metasAtingidas === null || metasTotal === null ? EM_DASH : `${metasAtingidas}/${metasTotal}`;
  const metasColor = metasAtingidas === null ? 'var(--amber)' : 'var(--green)';

  return unidades
    .filter((unit) => unit.status !== 'inativo')
    .map((unit) => {
      const isActive = unit.nome === activeUnit;
      const atendimentos = isActive ? (data.kpis_gerais?.total_atendimentos_aps ?? null) : null;
      const odonto = isActive ? (data.kpis_gerais?.atendimentos_odonto ?? null) : null;

      return {
        nome: unit.nome,
        tipo: unit.tipo,
        atendimentos: formatKpi(atendimentos),
        odonto: formatKpi(odonto),
        cobertura: EM_DASH,
        metas: isActive ? metasText : EM_DASH,
        metasColor: isActive ? metasColor : 'var(--amber)',
        isNull: !isActive || isNullKpi(atendimentos),
      };
    });
}
