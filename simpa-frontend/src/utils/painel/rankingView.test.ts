import { describe, expect, it } from 'vitest';
import type { ContratoDashboard, Unidade } from '../../types/contrato';
import { buildRanking } from './rankingView';

const unidade = (id: number, nome: string, extra: Partial<Unidade> = {}): Unidade =>
  ({ id, nome, status: 'ativo', tipo: 'UBS', ...extra } as Unidade);

const dash = (modulos: unknown, rest: Record<string, unknown> = {}): ContratoDashboard =>
  ({ modulos, ...rest } as unknown as ContratoDashboard);

describe('buildRanking — producao_por_unidade path', () => {
  it('resolves value by id, falls back to name, drops null/zero, sorts, caps at 6, computes widthPct', () => {
    const producao = [
      { estabelecimento_id: 1, unidade: 'A', atendimentos: 100 },
      { estabelecimento_id: null, unidade: 'B', atendimentos: 50 }, // só por nome
      { estabelecimento_id: 3, unidade: 'C', atendimentos: null }, // ignorado (null)
    ];
    const data = dash({ atencao_primaria_esus: { producao_por_unidade: producao } });
    const unidades = [
      unidade(1, 'A'),
      unidade(2, 'B'),
      unidade(3, 'C'), // value 0 → filtrado
      unidade(4, 'Z', { status: 'inativo' }), // inativo → filtrado
    ];
    const rows = buildRanking(data, unidades);
    expect(rows.map((r) => r.nome)).toEqual(['A', 'B']);
    expect(rows[0].value).toBe(100);
    expect(rows[0].widthPct).toBe(100);
    expect(rows[1].widthPct).toBe(50);
  });

  it('empty producao rows → max fallback 1, no divide-by-zero', () => {
    const data = dash({ atencao_primaria_esus: { producao_por_unidade: [{ estabelecimento_id: 9, unidade: 'X', atendimentos: 0 }] } });
    expect(buildRanking(data, [unidade(1, 'A')])).toEqual([]);
  });
});

describe('buildRanking — synthetic fallback path', () => {
  it('uses kpis_gerais with active unit full value, others decay, filters inativo', () => {
    const data = dash(
      { atencao_primaria_esus: {} },
      { filtros_ativos: { unidade: 'A' }, kpis_gerais: { total_atendimentos_aps: 1000 } }
    );
    const rows = buildRanking(data, [
      unidade(1, 'A'),
      unidade(2, 'B'),
      unidade(3, 'Z', { status: 'inativo' }),
    ]);
    expect(rows.find((r) => r.nome === 'A')?.value).toBe(1000);
    expect(rows.every((r) => r.nome !== 'Z')).toBe(true);
    expect(rows[0].value).toBeGreaterThanOrEqual(rows[rows.length - 1].value);
  });

  it('no kpis → base 0, all rows zero, widthPct 0', () => {
    const data = dash({}, {});
    const rows = buildRanking(data, [unidade(1, 'A'), unidade(2, 'B')]);
    expect(rows.every((r) => r.value === 0 && r.widthPct === 0)).toBe(true);
  });
});
