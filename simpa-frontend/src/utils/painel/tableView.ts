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

  // Produção e-SUS por unidade do agregado municipal (visão sem unidade selecionada).
  // Indexa por estabelecimento_id (fallback nome) para preencher atend./odonto de cada linha.
  const producao = data.modulos?.atencao_primaria_esus?.producao_por_unidade ?? [];
  const byId = new Map<number, { atendimentos: number | null; odonto: number | null }>();
  const byNome = new Map<string, { atendimentos: number | null; odonto: number | null }>();
  for (const p of producao) {
    const entry = { atendimentos: p.atendimentos ?? null, odonto: p.odonto ?? null };
    if (p.estabelecimento_id != null) byId.set(p.estabelecimento_id, entry);
    if (p.unidade) byNome.set(p.unidade, entry);
  }

  return unidades
    .filter((unit) => unit.status !== 'inativo')
    .map((unit) => {
      const isActive = unit.nome === activeUnit;
      const prod = byId.get(unit.id) ?? byNome.get(unit.nome) ?? null;
      // Com unidade selecionada usa o KPI geral; no agregado municipal usa producao_por_unidade.
      const atendimentos = isActive
        ? (data.kpis_gerais?.total_atendimentos_aps ?? null)
        : (prod?.atendimentos ?? null);
      const odonto = isActive
        ? (data.kpis_gerais?.atendimentos_odonto ?? null)
        : (prod?.odonto ?? null);

      return {
        nome: unit.nome,
        tipo: unit.tipo,
        atendimentos: formatKpi(atendimentos),
        odonto: formatKpi(odonto),
        cobertura: EM_DASH,
        metas: isActive ? metasText : EM_DASH,
        metasColor: isActive ? metasColor : 'var(--amber)',
        isNull: isNullKpi(atendimentos),
      };
    });
}
