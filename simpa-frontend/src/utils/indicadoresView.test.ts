import { describe, expect, it } from 'vitest';
import type { IndicadorQualidade, Unidade } from '../types/contrato';
import { EM_DASH } from './kpi';
import {
  buildBenchmarkRows,
  buildHistoricoSeries,
  buildMapPins,
  buildMetasResumo,
  buildRelatSintese,
  buildUnitComparison,
  computeAtingimento,
  enrichIndicador,
  formatAtingimentoText,
  formatExecText,
  resolveMetaStatus,
} from './indicadoresView';

function indicator(partial: Partial<IndicadorQualidade> & Pick<IndicadorQualidade, 'cod'>): IndicadorQualidade {
  return {
    cod: partial.cod,
    nomeCurto: partial.nomeCurto ?? partial.cod,
    nome: partial.nome ?? partial.cod,
    categoria: partial.categoria ?? 'Componente Qualidade APS',
    meta: partial.meta ?? null,
    exec: partial.exec ?? null,
    num: partial.num ?? '—',
    den: partial.den ?? '—',
    fonte: partial.fonte ?? 'e-SUS',
    periodicidade: partial.periodicidade ?? 'Quadrimestral',
    porUnidade: partial.porUnidade,
    historico: partial.historico,
  };
}

const unidades: Unidade[] = [
  { id: 1, codigo: 'CAFI001', nome: 'CAFI', tipo: 'APS', status: 'ativo' },
  { id: 2, codigo: 'UBS002', nome: 'UBS JARDIM SAO PAULO', tipo: 'APS', status: 'ativo' },
];

describe('indicadoresView meta status', () => {
  it('marks >=100% as green atingida', () => {
    expect(resolveMetaStatus(0.62, 0.5)).toMatchObject({ tone: 'green', label: 'atingida' });
    expect(resolveMetaStatus(0.5, 0.5)).toMatchObject({ tone: 'green', label: 'atingida' });
  });

  it('marks 90-99% as amber próxima', () => {
    expect(resolveMetaStatus(0.45, 0.5)).toMatchObject({ tone: 'amber', label: 'próxima' });
    expect(resolveMetaStatus(0.495, 0.5)).toMatchObject({ tone: 'amber', label: 'próxima' });
  });

  it('marks <90% as red abaixo', () => {
    expect(resolveMetaStatus(0.4, 0.5)).toMatchObject({ tone: 'red', label: 'abaixo' });
  });

  it('treats null exec/meta as não apurado with em dash', () => {
    expect(resolveMetaStatus(null, 0.5)).toMatchObject({ tone: 'null', label: 'Não apurado' });
    expect(formatExecText(null)).toBe(EM_DASH);
    expect(formatAtingimentoText(null, 0.5)).toBe(EM_DASH);
    expect(computeAtingimento(null, 0.5)).toBeNull();
    expect(enrichIndicador(indicator({ cod: 'C1', exec: null, meta: 0.5 })).execText).toBe(EM_DASH);
    expect(enrichIndicador(indicator({ cod: 'C1', exec: null, meta: 0.5 })).atingText).toBe(EM_DASH);
  });
});

describe('indicadoresView aggregations', () => {
  it('builds metas resumo counts by threshold', () => {
    const resumo = buildMetasResumo([
      indicator({ cod: 'A', exec: 0.7, meta: 0.6 }),
      indicator({ cod: 'B', exec: 0.55, meta: 0.6 }),
      indicator({ cod: 'C', exec: 0.4, meta: 0.6 }),
      indicator({ cod: 'D', exec: null, meta: 0.6 }),
    ]);

    expect(resumo[0]?.value).toBe('4');
    expect(resumo[1]?.value).toBe('1');
    expect(resumo[2]?.value).toBe('1');
    expect(resumo[3]?.value).toBe('1');
  });

  it('uses porUnidade data when available', () => {
    const rows = buildUnitComparison(
      indicator({
        cod: 'B1',
        exec: 0.58,
        meta: 0.6,
        porUnidade: [
          { unidade: 'CAFI', exec: 0.71 },
          { unidade: 'UBS JARDIM SAO PAULO', exec: 0.34 },
        ],
      }),
      unidades,
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]?.execText).toBe('71,0%');
  });

  it('builds synthetic history and benchmark rows', () => {
    const item = indicator({ cod: 'B1', exec: 0.58, meta: 0.6 });
    expect(buildHistoricoSeries(item)).toHaveLength(12);
    expect(buildHistoricoSeries(indicator({ cod: 'C1', exec: null }))).toEqual([]);
    expect(
      buildHistoricoSeries(
        indicator({
          cod: 'B2',
          exec: 0.7,
          historico: [{ competencia: '2026-05', exec: 0.7 }],
        }),
      ),
    ).toHaveLength(1);

    const benchmark = buildBenchmarkRows(item, unidades, 'CAFI');
    expect(benchmark.length).toBeGreaterThan(0);
    expect(buildMapPins(benchmark).length).toBeGreaterThan(0);
    expect(buildRelatSintese(item, benchmark).length).toBe(4);
  });
});
