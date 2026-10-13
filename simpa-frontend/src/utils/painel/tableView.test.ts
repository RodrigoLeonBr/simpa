import { describe, expect, it } from 'vitest';
import type { ContratoDashboard, Unidade } from '../../types/contrato';
import { buildUnitTable } from './tableView';
import { EM_DASH } from '../kpi';

const unidade = (id: number, nome: string, extra: Partial<Unidade> = {}): Unidade =>
  ({ id, nome, status: 'ativo', tipo: 'UBS', ...extra } as Unidade);

const dash = (modulos: unknown, rest: Record<string, unknown> = {}): ContratoDashboard =>
  ({ modulos, ...rest } as unknown as ContratoDashboard);

describe('buildUnitTable', () => {
  it('active unit uses kpis_gerais + metas text/color; others use producao_por_unidade', () => {
    const data = dash(
      {
        atencao_primaria_esus: {
          producao_por_unidade: [
            { estabelecimento_id: 2, unidade: 'B', atendimentos: 42, odonto: 7 },
          ],
        },
        financiamento_metas: { indicadores: [{ valor: 9, meta: 5 }, { valor: 1, meta: 5 }] },
      },
      { filtros_ativos: { unidade: 'A' }, kpis_gerais: { total_atendimentos_aps: 500, atendimentos_odonto: 80 } }
    );
    const rows = buildUnitTable(data, [
      unidade(1, 'A'),
      unidade(2, 'B'),
      unidade(3, 'Z', { status: 'inativo' }), // filtrado
    ]);
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.nome === 'A')!;
    expect(a.metas).toBe('1/2'); // 1 atingida de 2
    expect(a.metasColor).toBe('var(--green)');
    const b = rows.find((r) => r.nome === 'B')!;
    expect(b.metas).toBe(EM_DASH);
    expect(b.metasColor).toBe('var(--amber)');
  });

  it('no metas → EM_DASH and amber for active unit; name fallback in producao', () => {
    const data = dash(
      { atencao_primaria_esus: { producao_por_unidade: [{ unidade: 'B', atendimentos: 10, odonto: null }] } },
      { filtros_ativos: { unidade: 'A' } }
    );
    const rows = buildUnitTable(data, [unidade(1, 'A'), unidade(2, 'B')]);
    const a = rows.find((r) => r.nome === 'A')!;
    expect(a.metas).toBe(EM_DASH);
    expect(a.metasColor).toBe('var(--amber)');
    expect(a.isNull).toBe(true); // sem kpi de atendimentos
  });
});
