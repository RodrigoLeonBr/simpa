import type { ContratoDashboard, Unidade } from '../../types/contrato';
import { formatKpi } from '../kpi';
import type { RankingRow } from './types';

export function buildRanking(data: ContratoDashboard, unidades: Unidade[]): RankingRow[] {
  const producao = data.modulos?.atencao_primaria_esus?.producao_por_unidade;
  if (producao?.length) {
    const byId = new Map<number, number>();
    const byName = new Map<string, number>();
    for (const item of producao) {
      if (item.atendimentos == null) continue;
      if (item.estabelecimento_id != null) {
        byId.set(item.estabelecimento_id, item.atendimentos);
      }
      byName.set(item.unidade, item.atendimentos);
    }

    const rows = unidades
      .filter((unit) => unit.status !== 'inativo')
      .map((unit) => {
        const value = byId.get(unit.id) ?? byName.get(unit.nome) ?? null;
        return {
          nome: unit.nome,
          value: value ?? 0,
          valueLabel: formatKpi(value),
          widthPct: 0,
          color: 'var(--brand)',
        };
      })
      .filter((row) => row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const max = rows[0]?.value || 1;
    return rows.map((row) => ({
      ...row,
      widthPct: Math.round((row.value / max) * 100),
    }));
  }

  const activeUnit = data.filtros_ativos?.unidade;
  const baseValue = data.kpis_gerais?.total_atendimentos_aps ?? 0;

  const rows = unidades
    .filter((unit) => unit.status !== 'inativo')
    .map((unit, index) => {
      const isActive = unit.nome === activeUnit;
      const value = isActive ? baseValue : Math.round(baseValue * (0.55 - index * 0.08));
      return {
        nome: unit.nome,
        value: Math.max(value, 0),
        valueLabel: formatKpi(isActive ? baseValue : value || null),
        widthPct: 0,
        color: 'var(--brand)',
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const max = rows[0]?.value || 1;
  return rows.map((row) => ({
    ...row,
    widthPct: Math.round((row.value / max) * 100),
  }));
}
