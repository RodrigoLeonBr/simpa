jest.mock('../src/services/db', () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn(),
  },
}));

jest.mock('../src/services/painelMetricsService', () => ({
  executeMetric: jest.fn(),
}));

const { query } = require('../src/services/db');
const { executeMetric } = require('../src/services/painelMetricsService');
const {
  resolvePainelLayout,
  previewWidget,
  getPreviousCompetencia,
  computeDelta,
  resolveMetricValue,
  mapLineSeries,
  mapRankingRows,
  normalizePreviewDraft,
} = require('../src/services/painelWidgetsService');

describe('painelWidgetsService resolve/preview', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
  });

  it('card retorna valueLabel formatado para número', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          slug: 'atendimentos',
          ordem: 1,
          tipo: 'card',
          titulo: 'Atendimentos',
          subtitulo: null,
          formato: 'numero',
          metrica_id: 10,
          fonte_config: {},
          spark_metrica_id: null,
          delta_config: null,
        },
      ],
    });
    executeMetric.mockResolvedValueOnce({ rows: [{ valor: 1234 }], single: 1234 });

    const result = await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
    });

    expect(result.widgets[0].valueLabel).toBe('1.234');
    expect(result.widgets[0].value).toBe(1234);
  });

  it('aplica fallback_chave quando métrica primária vem nula', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            slug: 'atendimentos',
            ordem: 1,
            tipo: 'card',
            titulo: 'Atendimentos',
            formato: 'numero',
            metrica_id: 10,
            fonte_config: { fallback_chave: 'fallback.metric' },
            spark_metrica_id: null,
            delta_config: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 20, chave: 'fallback.metric' }] });

    executeMetric
      .mockResolvedValueOnce({ rows: [{ valor: null }], single: null })
      .mockResolvedValueOnce({ rows: [{ valor: 77 }], single: 77 });

    const result = await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
    });

    expect(query.mock.calls[1][0]).toContain('FROM painel_metricas_catalogo');
    expect(executeMetric).toHaveBeenNthCalledWith(2, 20, {
      competencia: '2026-05',
      estabelecimentoId: null,
      equipeId: null,
    });
    expect(result.widgets[0].value).toBe(77);
  });

  it('fracao metas retorna label "2 / 5"', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            id: 4,
            slug: 'metas',
            ordem: 4,
            tipo: 'card',
            titulo: 'Metas',
            formato: 'fracao',
            metrica_id: 41,
            fonte_config: { par_chave: 'metas.total' },
            spark_metrica_id: null,
            delta_config: { tipo: 'fixo', label: 'Comp. Qualidade' },
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ id: 42, chave: 'metas.total' }] });

    executeMetric
      .mockResolvedValueOnce({ rows: [{ valor: 2 }], single: 2 })
      .mockResolvedValueOnce({ rows: [{ valor: 5 }], single: 5 });

    const result = await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
    });

    expect(result.widgets[0].valueLabel).toBe('2 / 5');
    expect(result.widgets[0].delta).toEqual({ label: 'Comp. Qualidade', direction: 'flat' });
  });

  it('delta competencia_anterior chama executeMetric em meses adjacentes', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          slug: 'atendimentos',
          ordem: 1,
          tipo: 'card',
          titulo: 'Atendimentos',
          formato: 'numero',
          metrica_id: 10,
          fonte_config: {},
          spark_metrica_id: null,
          delta_config: { tipo: 'competencia_anterior' },
        },
      ],
    });
    executeMetric
      .mockResolvedValueOnce({ rows: [{ valor: 120 }], single: 120 })
      .mockResolvedValueOnce({ rows: [{ valor: 100 }], single: 100 });

    await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
    });

    expect(executeMetric).toHaveBeenNthCalledWith(1, 10, {
      competencia: '2026-05',
      estabelecimentoId: null,
      equipeId: null,
    });
    expect(executeMetric).toHaveBeenNthCalledWith(2, 10, {
      competencia: '2026-04',
      estabelecimentoId: null,
      equipeId: null,
    });
  });

  it('ranking com estabelecimentoId retorna no máximo uma linha', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 8,
          slug: 'ranking',
          ordem: 8,
          tipo: 'grafico_ranking',
          titulo: 'Ranking',
          formato: 'numero',
          metrica_id: 88,
          fonte_config: { limite: 6 },
          spark_metrica_id: null,
          delta_config: null,
        },
      ],
    });
    executeMetric.mockResolvedValueOnce({
      rows: [
        { unidade: 'UBS A', valor: 20, estabelecimento_id: 1 },
        { unidade: 'UBS B', valor: 10, estabelecimento_id: 2 },
      ],
      single: null,
    });

    const result = await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
      estabelecimentoId: 2,
    });

    expect(result.widgets[0].ranking).toHaveLength(1);
    expect(result.widgets[0].ranking[0].estabelecimento_id).toBe(2);
  });

  it('placeholder nulo gera isNull true e em-dash', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 3,
          slug: 'cobertura',
          ordem: 3,
          tipo: 'card',
          titulo: 'Cobertura',
          formato: 'numero',
          metrica_id: 33,
          fonte_config: {},
          spark_metrica_id: null,
          delta_config: { tipo: 'fixo', label: 'Não apurado' },
        },
      ],
    });
    executeMetric.mockResolvedValueOnce({ rows: [{ valor: null }], single: null });

    const result = await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
    });

    expect(result.widgets[0].isNull).toBe(true);
    expect(result.widgets[0].valueLabel).toBe('—');
  });

  it('previewWidget resolve draft body sem persistir', async () => {
    executeMetric.mockResolvedValueOnce({ rows: [{ valor: 9 }], single: 9 });

    const preview = await previewWidget(
      {
        tipo: 'card',
        titulo: 'Preview',
        formato: 'numero',
        metrica_id: 99,
        fonte_config: {},
      },
      { competencia: '2026-05' }
    );

    expect(preview.titulo).toBe('Preview');
    expect(preview.value).toBe(9);
  });

  it('resolvePainelLayout retorna 404 sem widgets ativos', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      resolvePainelLayout({
        perfil: 'APS',
        layout: 'A',
        competencia: '2026-05',
      })
    ).rejects.toMatchObject({ status: 404, code: 'WIDGETS_NOT_FOUND' });
  });

  it('previewWidget por id usa getWidgetById', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 12,
          slug: 'id_widget',
          ordem: 1,
          tipo: 'card',
          titulo: 'ID Widget',
          formato: 'numero',
          metrica_id: 7,
          fonte_config: {},
          spark_metrica_id: null,
          delta_config: null,
        },
      ],
    });
    executeMetric.mockResolvedValueOnce({ rows: [{ valor: 11 }], single: 11 });

    const preview = await previewWidget(12, { competencia: '2026-05' });
    expect(preview.slug).toBe('id_widget');
    expect(preview.value).toBe(11);
  });

  it('resolve card com sparkSeries usa métrica spark', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 21,
          slug: 'com_spark',
          ordem: 1,
          tipo: 'card',
          titulo: 'Com Spark',
          formato: 'numero',
          metrica_id: 70,
          fonte_config: {},
          spark_metrica_id: 71,
          delta_config: null,
        },
      ],
    });
    executeMetric
      .mockResolvedValueOnce({ rows: [{ valor: 100 }], single: 100 })
      .mockResolvedValueOnce({ rows: [{ valor: 1 }, { valor: 2 }, { valor: 'x' }], single: null });

    const result = await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
    });

    expect(result.widgets[0].sparkSeries).toEqual([1, 2]);
  });

  it('resolve grafico_linha popula series', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 30,
          slug: 'linha',
          ordem: 1,
          tipo: 'grafico_linha',
          titulo: 'Linha',
          formato: 'numero',
          metrica_id: 80,
          fonte_config: {},
        },
      ],
    });
    executeMetric.mockResolvedValueOnce({
      rows: [
        { competencia: '2026-04', valor: 10 },
        { competencia: '2026-05', valor: 20 },
      ],
      single: null,
    });

    const result = await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
    });

    expect(result.widgets[0].series).toHaveLength(2);
    expect(result.widgets[0].isNull).toBe(false);
  });

  it('computeDelta cobre flat/up/down e getPreviousCompetencia vira ano', () => {
    expect(computeDelta(null, 10)).toEqual({ label: '—', direction: 'flat' });
    expect(computeDelta(120, 100).direction).toBe('up');
    expect(computeDelta(80, 100).direction).toBe('down');
    expect(computeDelta(100, 100)).toEqual({ label: '0 estável', direction: 'flat' });
    expect(getPreviousCompetencia('2026-01')).toBe('2025-12');
    expect(getPreviousCompetencia('invalid')).toBe('invalid');
  });

  it('resolveMetricValue cobre sem métrica e fallback ausente', async () => {
    await expect(
      resolveMetricValue(null, { competencia: '2026-05' })
    ).resolves.toEqual({ rows: [], single: null });

    executeMetric.mockResolvedValueOnce({ rows: [{ valor: null }], single: null });
    query.mockResolvedValueOnce({ rows: [] });
    const fallbackMiss = await resolveMetricValue(10, { competencia: '2026-05' }, 'x.y');
    expect(fallbackMiss.single).toBeNull();
  });

  it('mapLineSeries/mapRankingRows filtram inválidos e respeitam limite', () => {
    const line = mapLineSeries([
      { competencia: '2026-05', valor: 2 },
      { competencia: '', valor: 3 },
    ]);
    expect(line).toEqual([{ competencia: '2026-05', valor: 2 }]);

    const ranking = mapRankingRows(
      [
        { unidade: 'UBS A', valor: 5, estabelecimento_id: 1 },
        { label: 'UBS B', valor: 4, estabelecimento_id: 2 },
        { unidade: '', valor: 3, estabelecimento_id: 3 },
      ],
      'numero',
      1
    );
    expect(ranking).toHaveLength(1);
    expect(ranking[0].label).toBe('UBS A');
  });

  it('normalizePreviewDraft aplica defaults e valida JSON', () => {
    const draft = normalizePreviewDraft({ metrica_id: 9 });
    expect(draft.slug).toBe('preview_widget');
    expect(draft.tipo).toBe('card');
    expect(draft.fonte_config).toEqual({});

    expect(() => normalizePreviewDraft({ spark_config: [] })).toThrow(
      'spark_config deve ser objeto JSON'
    );
  });

  it('resolve tipo desconhecido cai em widget nulo padrão', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 99,
          slug: 'desconhecido',
          ordem: 1,
          tipo: 'outro_tipo',
          titulo: 'Desconhecido',
          formato: 'numero',
          metrica_id: null,
          fonte_config: {},
        },
      ],
    });

    const result = await resolvePainelLayout({
      perfil: 'APS',
      layout: 'A',
      competencia: '2026-05',
    });

    expect(result.widgets[0].isNull).toBe(true);
    expect(result.widgets[0].valueLabel).toBe('—');
  });
});
