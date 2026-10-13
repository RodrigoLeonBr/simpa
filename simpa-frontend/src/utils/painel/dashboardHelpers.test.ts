import { describe, expect, it } from 'vitest';
import type { ContratoDashboard } from '../../types/contrato';
import {
  historicoSorted,
  sparkFromHistorico,
  countMetasAtingidas,
  countMetasTotal,
} from './dashboardHelpers';

const d = (modulos: unknown): ContratoDashboard => ({ modulos } as unknown as ContratoDashboard);

describe('historicoSorted', () => {
  it('returns [] when no historico', () => {
    expect(historicoSorted(d({}))).toEqual([]);
    expect(historicoSorted(d({ atencao_primaria_esus: { historico_mensal: [] } }))).toEqual([]);
  });

  it('sorts by competencia ascending (without mutating input)', () => {
    const historico = [{ competencia: '2026-03' }, { competencia: '2026-01' }, { competencia: '2026-02' }];
    const data = d({ atencao_primaria_esus: { historico_mensal: historico } });
    const out = historicoSorted(data);
    expect(out.map((h) => h.competencia)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(historico[0].competencia).toBe('2026-03'); // original intact
  });
});

describe('sparkFromHistorico', () => {
  it('maps numeric field, non-number → 0', () => {
    const historico = [
      { competencia: '2026-01', atendimentos: 10 },
      { competencia: '2026-02', atendimentos: null },
      { competencia: '2026-03' },
    ] as unknown as Parameters<typeof sparkFromHistorico>[0];
    expect(sparkFromHistorico(historico, 'atendimentos')).toEqual([10, 0, 0]);
  });
});

describe('countMetasAtingidas / countMetasTotal', () => {
  it('null when there are no valid indicadores', () => {
    expect(countMetasAtingidas(d({}))).toBeNull();
    expect(countMetasTotal(d({}))).toBeNull();
  });

  it('reads flat indicadores array', () => {
    const data = d({
      financiamento_metas: {
        indicadores: [
          { valor: 8, meta: 5 }, // atingida
          { valor: 2, meta: 5 }, // não
          { valor: null, meta: null }, // inválida p/ atingidas
        ],
      },
    });
    expect(countMetasAtingidas(data)).toBe(1);
    // total conta onde meta OU valor != null → 2
    expect(countMetasTotal(data)).toBe(2);
  });

  it('aggregates nested componente_qualidade_aps and igm_sus_paulista', () => {
    const data = d({
      financiamento_metas: {
        componente_qualidade_aps: { indicadores: [{ valor: 5, meta: 5 }] },
        igm_sus_paulista: { indicadores: [{ valor: 1, meta: 9 }] },
      },
    });
    expect(countMetasAtingidas(data)).toBe(1); // só o 5>=5
    expect(countMetasTotal(data)).toBe(2);
  });

  it('ignores nested blocks that are arrays (not object with indicadores)', () => {
    const data = d({
      financiamento_metas: {
        componente_qualidade_aps: [{ valor: 5, meta: 5 }],
        igm_sus_paulista: [{ valor: 5, meta: 5 }],
      },
    });
    expect(countMetasAtingidas(data)).toBeNull();
    expect(countMetasTotal(data)).toBeNull();
  });
});
