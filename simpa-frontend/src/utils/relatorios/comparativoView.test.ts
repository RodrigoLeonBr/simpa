import { describe, expect, it } from 'vitest';
import type { IndicadorQualidade, Unidade } from '../../types/contrato';
import { buildBenchmarkRows, buildMapPins, buildRelatSintese } from './comparativoView';

const u = (id: number, nome: string, extra: Partial<Unidade> = {}): Unidade =>
  ({ id, nome, status: 'ativo', tipo: 'UBS', ...extra } as Unidade);
const ind = (over: Partial<IndicadorQualidade> = {}): IndicadorQualidade =>
  ({ cod: 'C1', exec: 0.8, meta: 0.6, ...over } as IndicadorQualidade);

describe('buildBenchmarkRows', () => {
  it('ranks by exec, computes diff sign/text/color from porUnidade', () => {
    const indicador = ind({
      porUnidade: [
        { unidade: 'A', exec: 0.9 },
        { unidade: 'B', exec: 0.3 },
        { unidade: 'C', exec: null },
      ],
    });
    const rows = buildBenchmarkRows(indicador, [u(1, 'A'), u(2, 'B'), u(3, 'C')], 'A');
    expect(rows[0].rank).toBe('01');
    expect(rows[0].nome).toBe('A'); // maior exec primeiro
    expect(rows[0].diffText).toMatch(/^\+/); // acima da média
    expect(rows[0].diffColor).toBeDefined();
    // linha com exec null → diff EM_DASH (sem "p.p.")
    const cRow = rows.find((r) => r.nome === 'C')!;
    expect(cRow.diffText).toBe('—');
  });

  it('active unit without porUnidade match uses indicador.exec', () => {
    const rows = buildBenchmarkRows(ind({ porUnidade: [] }), [u(1, 'A')], 'A');
    expect(rows).toHaveLength(1);
  });
});

describe('buildMapPins', () => {
  it('caps at 8 positions, assigns size/color', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ color: `c${i}` })) as never[];
    const pins = buildMapPins(rows);
    expect(pins).toHaveLength(8);
    expect(pins[0].size).toBe('18px');
    expect(pins[0].color).toBe('c0');
  });
});

describe('buildRelatSintese', () => {
  it('computes média/melhor and counts above meta', () => {
    const rows = [
      { execText: '90,0%', color: 'x' },
      { execText: '30,0%', color: 'x' },
      { execText: '—', color: 'x' }, // ignorado
    ] as never[];
    const out = buildRelatSintese(ind({ meta: 0.5 }), rows);
    const byLabel = Object.fromEntries(out.map((r) => [r.label, r.value]));
    expect(byLabel['Unidades acima da meta']).toBe('1'); // só 0.9 >= 0.5
    expect(byLabel['Meta regulamentada']).toBeDefined();
  });

  it('meta null → aboveMeta is EM_DASH; empty rows → média/melhor null', () => {
    const out = buildRelatSintese(ind({ meta: null }), [] as never[]);
    const byLabel = Object.fromEntries(out.map((r) => [r.label, r.value]));
    expect(byLabel['Unidades acima da meta']).toBe('—');
  });
});
