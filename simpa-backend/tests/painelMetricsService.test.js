jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  bindTemplate,
  executeMetric,
  slugifySegment,
  buildMetricKey,
  buildDiscoveredSqlTemplate,
  buildRelationalMetricKey,
  buildRelationalSumSqlTemplate,
  discoverMetricsFromRaw,
  discoverMetricsFromSia,
  discoverPainelMetricas,
  listMetricas,
  getMetricaById,
  extractSingleValue,
  MetricNotFoundError,
  InvalidMetricTemplateError,
  InvalidMetricScopeError,
} = require('../src/services/painelMetricsService');

describe('painelMetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  describe('bindTemplate', () => {
    it('mapeia placeholders whitelist para $1/$2/$3 em ordem fixa', () => {
      const bound = bindTemplate(
        `SELECT *
         FROM foo
         WHERE competencia = :competencia::date
           AND (:estabelecimento_id::bigint IS NULL OR estabelecimento_id = :estabelecimento_id::bigint)
           AND (:equipe_id::bigint IS NULL OR equipe_id = :equipe_id::bigint)`,
        {
          competencia: '2026-05',
          estabelecimentoId: 10,
          equipeId: 11,
        }
      );

      expect(bound.text).toContain('competencia = $1::date');
      expect(bound.text).toContain('($2::bigint IS NULL OR estabelecimento_id = $2::bigint)');
      expect(bound.text).toContain('($3::bigint IS NULL OR equipe_id = $3::bigint)');
      expect(bound.values).toEqual(['2026-05-01', 10, 11]);
    });

    it('lança erro para placeholder não permitido', () => {
      expect(() =>
        bindTemplate('SELECT * FROM foo WHERE x = :user_input', {
          competencia: '2026-05',
        })
      ).toThrow(InvalidMetricTemplateError);
    });

    it('lança erro para múltiplas statements', () => {
      expect(() =>
        bindTemplate('SELECT 1; SELECT 2', {
          competencia: '2026-05',
        })
      ).toThrow(InvalidMetricTemplateError);
    });

    it('lança erro quando competencia tem mês inválido', () => {
      expect(() =>
        bindTemplate('SELECT :competencia::date AS valor', {
          competencia: '2026-13',
        })
      ).toThrow(InvalidMetricScopeError);
    });

    it('lança erro quando competencia ausente ou formato inválido', () => {
      expect(() => bindTemplate('SELECT 1', {})).toThrow('competencia obrigatória');
      expect(() =>
        bindTemplate('SELECT :competencia::date', { competencia: '202605' })
      ).toThrow('competencia inválida');
    });

    it('lança erro para id inválido, sql vazio e sql não-string', () => {
      expect(() =>
        bindTemplate('SELECT :competencia::date', {
          competencia: '2026-05',
          estabelecimentoId: -10,
        })
      ).toThrow('estabelecimento_id inválido');
      expect(() =>
        bindTemplate('   ', {
          competencia: '2026-05',
        })
      ).toThrow(InvalidMetricTemplateError);
      expect(() =>
        bindTemplate(null, {
          competencia: '2026-05',
        })
      ).toThrow(InvalidMetricTemplateError);
    });

    it('usa apenas placeholders presentes no SQL', () => {
      const semFiltros = bindTemplate('SELECT NULL::bigint AS valor', {
        competencia: '2026-05',
        estabelecimentoId: 10,
        equipeId: 11,
      });
      expect(semFiltros.values).toEqual([]);

      const apenasCompetencia = bindTemplate(
        'SELECT 1 WHERE :competencia::date IS NOT NULL',
        {
          competencia: '2026-05',
          estabelecimentoId: 10,
          equipeId: 11,
        }
      );
      expect(apenasCompetencia.text).toContain('$1::date');
      expect(apenasCompetencia.values).toEqual(['2026-05-01']);
    });
  });

  describe('executeMetric', () => {
    it('retorna single a partir do primeiro valor numérico da coluna valor', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ id: 1, sql_template: 'SELECT 10 AS valor WHERE :competencia::date IS NOT NULL' }],
        })
        .mockResolvedValueOnce({
          rows: [{ valor: '42' }],
        });

      const result = await executeMetric(1, {
        competencia: '2026-05',
        estabelecimentoId: 99,
        equipeId: 101,
      });

      expect(query).toHaveBeenCalledTimes(2);
      expect(result.rows).toEqual([{ valor: '42' }]);
      expect(result.single).toBe(42);
    });

    it('retorna erro descritivo para metricaId desconhecido', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        executeMetric(999, {
          competencia: '2026-05',
        })
      ).rejects.toThrow(MetricNotFoundError);
    });

    it('binda estabelecimento/equipe nulos para escopo municipal', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              sql_template:
                'SELECT :competencia::date AS competencia, :estabelecimento_id::bigint AS e, :equipe_id::bigint AS eq',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ valor: null }],
        });

      await executeMetric(1, {
        competencia: '2026-05',
        estabelecimentoId: null,
        equipeId: null,
      });

      expect(query.mock.calls[1][1]).toEqual(['2026-05-01', null, null]);
    });

    it('falha quando metricaId é inválido', async () => {
      await expect(
        executeMetric('abc', {
          competencia: '2026-05',
        })
      ).rejects.toThrow(InvalidMetricScopeError);
    });

    it('falha quando sql_template da métrica é inválido', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1, sql_template: '' }],
      });

      await expect(
        executeMetric(1, {
          competencia: '2026-05',
        })
      ).rejects.toThrow(InvalidMetricTemplateError);
    });
  });

  describe('extractSingleValue', () => {
    it('retorna null para lista vazia e valor não numérico', () => {
      expect(extractSingleValue([])).toBeNull();
      expect(extractSingleValue([{ valor: 'abc' }])).toBeNull();
    });
  });

  describe('discoverMetricsFromRaw', () => {
    it('slug helper converte "Resumo de produção" em segmento estável', () => {
      expect(slugifySegment('Resumo de produção')).toBe('resumo.de.producao');
      expect(
        buildMetricKey({
          tipo_relatorio: 'atendimento_individual',
          secao: 'Resumo de produção',
          descricao: 'Registros identificados',
          campo_json: 'quantidade',
        })
      ).toBe(
        'esus.atendimento.individual.resumo.de.producao.registros.identificados.quantidade'
      );
    });

    it('insere nova combinação raw com sql_template gerado', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
            {
              tipo_relatorio: 'atendimento_individual',
              secao: 'Resumo de produção',
              descricao: 'Registros identificados',
              campo_json: 'quantidade',
              ocorrencias: 3,
              ultima_carga_em: '2026-06-01T12:00:00Z',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ inserted: true }],
        });

      const result = await discoverMetricsFromRaw();

      expect(result).toEqual({ inserted: 1, updated: 0 });
      expect(query.mock.calls[1][0]).toContain('ON CONFLICT (chave) DO UPDATE SET');
      expect(query.mock.calls[1][0]).toContain('sql_template = CASE');
      expect(query.mock.calls[1][1][0]).toContain(
        'esus.atendimento.individual.resumo.de.producao.registros.identificados.quantidade'
      );
      expect(query.mock.calls[1][1][9]).toContain("NULLIF(r.valores->>'quantidade', '')::numeric");
    });

    it('atualiza chave seed existente sem sobrescrever sql_template curado', async () => {
      query
        .mockResolvedValueOnce({
          rows: [
            {
              tipo_relatorio: 'atendimento_individual',
              secao: 'Resumo de produção',
              descricao: 'Registros identificados',
              campo_json: 'quantidade',
              ocorrencias: 2,
              ultima_carga_em: '2026-06-01T12:00:00Z',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ inserted: false }],
        });

      const result = await discoverMetricsFromRaw();

      expect(result).toEqual({ inserted: 0, updated: 1 });
      expect(query.mock.calls[1][0]).toContain('ocorrencias = painel_metricas_catalogo.ocorrencias + EXCLUDED.ocorrencias');
      expect(query.mock.calls[1][0]).toContain("COALESCE(BTRIM(painel_metricas_catalogo.sql_template), '') <> ''");
    });

    it('retorna zero quando scan não encontra métricas', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await expect(discoverMetricsFromRaw()).resolves.toEqual({
        inserted: 0,
        updated: 0,
      });
    });

    it('escapa aspas simples ao gerar sql_template', () => {
      const template = buildDiscoveredSqlTemplate({
        tipo_relatorio: "atendimento_individual",
        secao: "Resumo d'produção",
        descricao: "Registros d'equipe",
        campo_json: "quantidade",
      });

      expect(template).toContain("r.secao = 'Resumo d''produção'");
      expect(template).toContain("r.descricao = 'Registros d''equipe'");
    });

    it('trunca chave descoberta para 160 caracteres', () => {
      const key = buildMetricKey({
        tipo_relatorio: 'atendimento_individual',
        secao: 'x'.repeat(120),
        descricao: 'y'.repeat(120),
        campo_json: 'quantidade',
      });
      expect(key.length).toBe(160);
    });
  });

  describe('discoverMetricsFromSia/Sih', () => {
    it('buildRelationalMetricKey usa prefixo e coluna', () => {
      expect(buildRelationalMetricKey('sia.col', 'quantidade')).toBe('sia.col.quantidade');
      expect(buildRelationalSumSqlTemplate({
        tableName: 'sia_producao',
        tableAlias: 'sp',
        columnName: 'quantidade',
      })).toContain('SUM(sp.quantidade)');
    });

    it('discoverMetricsFromSia retorna zero sem produção importada', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ ocorrencias: 0, ultima_carga_em: null }] })
        .mockResolvedValueOnce({ rows: [] });
      await expect(discoverMetricsFromSia()).resolves.toEqual({ inserted: 0, updated: 0 });
    });

    it('discoverMetricsFromSia upserta colunas numéricas e atualiza métricas curadas', async () => {
      query
        .mockResolvedValueOnce({
          rows: [{ ocorrencias: 12, ultima_carga_em: '2026-06-01T12:00:00Z' }],
        })
        .mockResolvedValueOnce({
          rows: [{ column_name: 'quantidade' }, { column_name: 'valor_aprovado' }],
        })
        .mockResolvedValueOnce({ rows: [{ inserted: true }] })
        .mockResolvedValueOnce({ rows: [{ inserted: false }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      const result = await discoverMetricsFromSia();

      expect(result).toEqual({ inserted: 1, updated: 3 });
      expect(query.mock.calls[2][1][0]).toBe('sia.col.quantidade');
      expect(query.mock.calls[2][0]).toContain("fonte_tipo, label, descricao");
      expect(query.mock.calls[4][0]).toContain("m.chave NOT LIKE 'sia.col.%'");
    });

    it('discoverPainelMetricas agrega e-SUS, SIA e SIHD', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ocorrencias: 0, ultima_carga_em: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ocorrencias: 0, ultima_carga_em: null }] })
        .mockResolvedValueOnce({ rows: [{ ocorrencias: 0, ultima_carga_em: null }] })
        .mockResolvedValueOnce({ rows: [{ ocorrencias: 0, ultima_carga_em: null }] })
        .mockResolvedValueOnce({ rows: [] });

      await expect(discoverPainelMetricas()).resolves.toEqual({
        inserted: 0,
        updated: 0,
        sources: {
          esus_raw: { inserted: 0, updated: 0 },
          sia: { inserted: 0, updated: 0 },
          sih: { inserted: 0, updated: 0 },
        },
      });
    });
  });

  describe('listMetricas/getMetricaById', () => {
    it('lista métricas com busca q e fonte_tipo', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({
          rows: [{ id: 1, label: 'Atendimento', chave: 'esus.atendimento' }],
        });

      const result = await listMetricas({
        q: 'atendimento',
        fonte_tipo: 'esus_raw',
        page: 1,
        limit: 10,
      });

      expect(query.mock.calls[0][0]).toContain('COUNT(*)::int AS total');
      expect(query.mock.calls[0][0]).toContain('label ILIKE $1');
      expect(query.mock.calls[0][0]).toContain('fonte_tipo = $2');
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('getMetricaById retorna 404 quando não encontra', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await expect(getMetricaById(999)).rejects.toMatchObject({ status: 404 });
    });

    it('getMetricaById retorna linha completa quando encontra', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 2, chave: 'x', sql_template: 'SELECT 1 AS valor' }],
      });

      const row = await getMetricaById(2);
      expect(row.sql_template).toContain('SELECT 1');
    });

    it('lista métricas sem filtro usa ordenação por ocorrências', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      await listMetricas({});

      expect(query.mock.calls[1][0]).toContain('ORDER BY ocorrencias DESC, label ASC');
    });

    it('getMetricaById com id inválido retorna 404', async () => {
      await expect(getMetricaById('abc')).rejects.toMatchObject({ status: 404 });
    });
  });
});
