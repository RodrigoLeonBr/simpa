jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  parseCompetencia,
  buildDashboardQuery,
  envelopeDashboard,
  fetchDashboard,
} = require('../src/services/dashboardService');
const { samplePayload } = require('./fixtures/sampleContrato');

describe('dashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseCompetencia', () => {
    it('rejects missing competencia', () => {
      expect(parseCompetencia(undefined).ok).toBe(false);
    });

    it('rejects invalid format', () => {
      expect(parseCompetencia('05-2026').ok).toBe(false);
    });

    it('accepts YYYY-MM', () => {
      const parsed = parseCompetencia('2026-05');
      expect(parsed).toEqual({ ok: true, label: '2026-05', date: '2026-05-01' });
    });
  });

  describe('envelopeDashboard', () => {
    it('returns stored full payload when dados_conteudo is complete', () => {
      const row = {
        unidade: samplePayload.filtros_ativos.unidade,
        equipe: samplePayload.filtros_ativos.equipe,
        municipio: 'AMERICANA',
        versao_schema: '3.1.0',
        dados_conteudo: samplePayload,
      };

      expect(envelopeDashboard(row, '2026-05')).toEqual(samplePayload);
    });

    it('wraps partial legacy content preserving null KPIs', () => {
      const row = {
        unidade: 'U1',
        equipe: 'E1',
        municipio: 'AMERICANA',
        versao_schema: '3.1.0',
        dados_conteudo: {
          kpis_gerais: {
            total_atendimentos_aps: null,
            total_procedimentos_ambulatoriais: null,
            total_participantes_coletivos: null,
            atendimentos_odonto: null,
          },
          modulos: samplePayload.modulos,
        },
      };

      const result = envelopeDashboard(row, '2026-05');

      expect(result.kpis_gerais.total_atendimentos_aps).toBeNull();
      expect(result.versao_schema).toBe('3.1.0');
      expect(result.filtros_ativos).toEqual({ unidade: 'U1', equipe: 'E1' });
      expect(result.indicadores_qualidade).toEqual([]);
    });
  });

  describe('buildDashboardQuery', () => {
    it('filters by estabelecimento_id and equipe_id when both provided', () => {
      const { sql, params } = buildDashboardQuery({
        competenciaDate: '2026-05-01',
        estabelecimentoId: 42,
        equipeId: 7,
      });

      expect(sql).toMatch(/estabelecimento_id = \$2/);
      expect(sql).toMatch(/equipe_id = \$3/);
      expect(sql).not.toMatch(/unidade =/);
      expect(params).toEqual(['2026-05-01', 42, 7]);
    });

    it('filters by estabelecimento_id alone when equipe omitted', () => {
      const { sql, params } = buildDashboardQuery({
        competenciaDate: '2026-05-01',
        estabelecimentoId: 42,
      });

      expect(sql).toMatch(/estabelecimento_id = \$2/);
      expect(sql).not.toMatch(/equipe_id =/);
      expect(params).toEqual(['2026-05-01', 42]);
    });

    it('falls back to text unidade/equipe when IDs absent', () => {
      const { sql, params } = buildDashboardQuery({
        competenciaDate: '2026-05-01',
        unidade: 'CAFI',
        equipe: 'EQUIPE 9 EAP',
      });

      expect(sql).toMatch(/unidade = \$2/);
      expect(sql).toMatch(/equipe = \$3/);
      expect(sql.split('WHERE')[1]).not.toMatch(/estabelecimento_id =/);
      expect(params).toEqual(['2026-05-01', 'CAFI', 'EQUIPE 9 EAP']);
    });
  });

  describe('fetchDashboard', () => {
    it('returns 400 when competencia is missing', async () => {
      const result = await fetchDashboard({});
      expect(result.status).toBe(400);
      expect(result.body.error).toMatch(/competencia/i);
      expect(query).not.toHaveBeenCalled();
    });

    it('returns 404 when no row matches filters', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await fetchDashboard({
        competencia: '2026-05',
        unidade: 'CAFI',
        equipe: 'EQUIPE 9 EAP',
      });

      expect(result.status).toBe(404);
      expect(result.body.filtros.competencia).toBe('2026-05');
    });

    it('returns 404 with ID filtros and logs dashboard.miss when ID query empty', async () => {
      query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await fetchDashboard({
        competencia: '2026-05',
        estabelecimento_id: '42',
        equipe_id: '7',
      });

      expect(result.status).toBe(404);
      expect(result.body.filtros).toEqual({
        competencia: '2026-05',
        unidade: null,
        equipe: null,
        estabelecimento_id: 42,
        equipe_id: 7,
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"dashboard.miss"')
      );
      logSpy.mockRestore();
    });

    it('returns 200 when estabelecimento_id alone matches consolidated row', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            unidade: samplePayload.filtros_ativos.unidade,
            equipe: samplePayload.filtros_ativos.equipe,
            municipio: 'AMERICANA',
            versao_schema: '3.1.0',
            estabelecimento_id: 42,
            equipe_id: 7,
            dados_conteudo: samplePayload,
          },
        ],
      });

      const result = await fetchDashboard({
        competencia: '2026-05',
        estabelecimento_id: '42',
      });

      expect(result.status).toBe(200);
      expect(query.mock.calls[0][0]).toMatch(/estabelecimento_id = \$2/);
      expect(query.mock.calls[0][0]).not.toMatch(/equipe_id =/);
    });

    it('falls back to legacy text labels when ID query misses', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ unidade: 'CAFI', equipe: 'EQUIPE 9 EAP' }],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              unidade: 'CAFI',
              equipe: 'EQUIPE 9 EAP',
              municipio: 'AMERICANA',
              versao_schema: '3.1.0',
              dados_conteudo: samplePayload,
            },
          ],
        });

      const result = await fetchDashboard({
        competencia: '2026-05',
        estabelecimento_id: '42',
        equipe_id: '7',
      });

      expect(result.status).toBe(200);
      expect(query.mock.calls[2][0]).toMatch(/unidade = \$2/);
    });

    it('returns 400 when only equipe_id is provided', async () => {
      const result = await fetchDashboard({
        competencia: '2026-05',
        equipe_id: '7',
      });

      expect(result.status).toBe(400);
      expect(query).not.toHaveBeenCalled();
    });

    it('returns 200 when row matches cadastro IDs', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            unidade: samplePayload.filtros_ativos.unidade,
            equipe: samplePayload.filtros_ativos.equipe,
            municipio: 'AMERICANA',
            versao_schema: '3.1.0',
            estabelecimento_id: 42,
            equipe_id: 7,
            dados_conteudo: samplePayload,
          },
        ],
      });

      const result = await fetchDashboard({
        competencia: '2026-05',
        estabelecimento_id: '42',
        equipe_id: '7',
      });

      expect(result.status).toBe(200);
      expect(query.mock.calls[0][0]).toMatch(/estabelecimento_id = \$2/);
      expect(query.mock.calls[0][1]).toEqual(['2026-05-01', 42, 7]);
    });

    it('returns 200 with envelope when row exists', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            unidade: samplePayload.filtros_ativos.unidade,
            equipe: samplePayload.filtros_ativos.equipe,
            municipio: 'AMERICANA',
            versao_schema: '3.1.0',
            dados_conteudo: samplePayload,
          },
        ],
      });

      const result = await fetchDashboard({
        competencia: '2026-05',
        unidade: samplePayload.filtros_ativos.unidade,
        equipe: samplePayload.filtros_ativos.equipe,
      });

      expect(result.status).toBe(200);
      expect(result.body.versao_schema).toBe('3.1.0');
      expect(result.body.indicadores_qualidade.length).toBeGreaterThan(0);
    });
  });
});
