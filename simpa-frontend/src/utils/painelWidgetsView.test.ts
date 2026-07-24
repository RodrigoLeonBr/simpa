import { describe, expect, it } from 'vitest';
import type { ResolvedPainelWidget } from '../types/painelWidgets';
import {
  mapWidgetToKpi,
  mapWidgetToRanking,
  mapWidgetToTrendSeries,
  splitPainelWidgetsByTipo,
  pickLayoutSlotWidgets,
} from './painelWidgetsView';
import { EM_DASH } from './kpi';

function baseWidget(overrides: Partial<ResolvedPainelWidget> = {}): ResolvedPainelWidget {
  return {
    slug: 'w1',
    ordem: 1,
    tipo: 'card',
    titulo: 'Widget',
    subtitulo: null,
    formato: 'numero',
    value: 10,
    valueLabel: '10',
    isNull: false,
    ...overrides,
  };
}

describe('painelWidgetsView', () => {
  it('card nulo mapeia para isNull=true e valor EM_DASH', () => {
    const kpi = mapWidgetToKpi(
      baseWidget({
        value: null,
        valueLabel: 'Não apurado',
        isNull: true,
      })
    );

    expect(kpi.isNull).toBe(true);
    expect(kpi.value).toBe(EM_DASH);
  });

  it('card sem sparkSeries retorna array vazio', () => {
    const kpi = mapWidgetToKpi(
      baseWidget({
        sparkSeries: undefined,
      })
    );
    expect(kpi.sparkSeries).toEqual([]);
  });

  it('fracao preserva valueLabel no KPI', () => {
    const kpi = mapWidgetToKpi(
      baseWidget({
        formato: 'fracao',
        value: 2,
        valueLabel: '2 / 5',
      })
    );

    expect(kpi.value).toBe('2 / 5');
  });

  it('grafico_linha produz série de tendência não vazia', () => {
    const trend = mapWidgetToTrendSeries(
      baseWidget({
        tipo: 'grafico_linha',
        series: [
          { competencia: '2026-04', valor: 9 },
          { competencia: '2026-05', valor: 12 },
        ],
      })
    );

    expect(trend).toHaveLength(2);
    expect(trend[0]).toMatchObject({
      competencia: '2026-04',
      atendimentos: 9,
      meta: null,
    });
  });

  it('grafico_linha sem série retorna vazio', () => {
    const trend = mapWidgetToTrendSeries(
      baseWidget({
        tipo: 'grafico_linha',
        series: undefined,
      })
    );
    expect(trend).toEqual([]);
  });

  it('grafico_ranking respeita limite configurado', () => {
    const ranking = mapWidgetToRanking(
      baseWidget({
        tipo: 'grafico_ranking',
        ranking: [
          { label: 'UBS 1', valor: 50, valueLabel: '50' },
          { label: 'UBS 2', valor: 40, valueLabel: '40' },
          { label: 'UBS 3', valor: 30, valueLabel: '30' },
        ],
      }),
      { limit: 2 }
    );

    expect(ranking).toHaveLength(2);
    expect(ranking[0].widthPct).toBe(100);
  });

  it('grafico_ranking vazio retorna lista vazia', () => {
    const ranking = mapWidgetToRanking(
      baseWidget({
        tipo: 'grafico_ranking',
        ranking: [],
      })
    );
    expect(ranking).toEqual([]);
  });

  it('separa widgets por tipo para cards e charts', () => {
    const split = splitPainelWidgetsByTipo([
      baseWidget({ tipo: 'card' }),
      baseWidget({ slug: 'w2', tipo: 'grafico_linha' }),
      baseWidget({ slug: 'w3', tipo: 'grafico_ranking' }),
      baseWidget({ slug: 'w4', tipo: 'grafico_barra' }),
    ]);

    expect(split.cards).toHaveLength(1);
    expect(split.linhas).toHaveLength(1);
    expect(split.rankings).toHaveLength(2);
    expect(split.outros).toHaveLength(0);
  });

  it('pickLayoutSlotWidgets escolhe primeiro line/ranking pela ordem global', () => {
    const sorted = [
      baseWidget({ slug: 'rank-a', ordem: 1, tipo: 'grafico_ranking', titulo: 'Rank A' }),
      baseWidget({ slug: 'card-b', ordem: 2, tipo: 'card', titulo: 'Card B' }),
      baseWidget({ slug: 'line-c', ordem: 8, tipo: 'grafico_linha', titulo: 'Line C' }),
      baseWidget({ slug: 'rank-d', ordem: 9, tipo: 'grafico_ranking', titulo: 'Rank D' }),
    ];

    const slots = pickLayoutSlotWidgets(sorted);

    expect(slots.cards.map((w) => w.slug)).toEqual(['card-b']);
    expect(slots.lineWidget?.slug).toBe('line-c');
    expect(slots.rankingWidget?.slug).toBe('rank-a');
  });
});
