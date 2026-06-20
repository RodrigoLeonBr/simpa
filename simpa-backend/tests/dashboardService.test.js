jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  parseCompetencia,
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
