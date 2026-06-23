jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  parseCompetencia,
  getPopulacao,
  listPopulacaoCompetencias,
  _aggregate,
} = require('../src/services/populacaoService');

describe('populacaoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── parseCompetencia ────────────────────────────────────────────────────────

  describe('parseCompetencia', () => {
    it('returns error when competencia is undefined', () => {
      const result = parseCompetencia(undefined);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/obrigatório/i);
    });

    it('returns error when format is invalid', () => {
      const result = parseCompetencia('05-2026');
      expect(result.ok).toBe(false);
    });

    it('accepts YYYY-MM format and returns date string', () => {
      const result = parseCompetencia('2026-01');
      expect(result.ok).toBe(true);
      expect(result.date).toBe('2026-01-01');
    });
  });

  // ─── _aggregate ──────────────────────────────────────────────────────────────

  describe('_aggregate', () => {
    const row1 = {
      estabelecimento_id: 5,
      estabelecimento_nome: 'PSF JD Alvorada',
      competencia: '2026-01-01',
      cidadaos_ativos: 3337,
      saidas: 1198,
      importado_em: '2026-06-22T14:30:00Z',
      faixa_etaria: [
        { faixa: 'Menos de 01 ano', masculino: 20, feminino: 15 },
        { faixa: '01 ano', masculino: 10, feminino: 8 },
      ],
      condicoes_saude: {
        gestante: { sim: 14, nao: 150, nao_informado: 1500 },
        hipertensao: { sim: 200, nao: 300, nao_informado: 1200 },
      },
      raca_cor: { branca: 1500, preta: 50, parda: 300 },
    };

    const row2 = {
      estabelecimento_id: 6,
      estabelecimento_nome: 'UBS Central',
      competencia: '2026-01-01',
      cidadaos_ativos: 6836,
      saidas: 2409,
      importado_em: '2026-06-22T14:35:00Z',
      faixa_etaria: [
        { faixa: 'Menos de 01 ano', masculino: 11, feminino: 11 },
        { faixa: '02 anos', masculino: 9, feminino: 7 },
      ],
      condicoes_saude: {
        gestante: { sim: 10, nao: 134, nao_informado: 1529 },
        hipertensao: { sim: 113, nao: 303, nao_informado: 1221 },
      },
      raca_cor: { branca: 1070, preta: 42, parda: 338 },
    };

    it('sums cidadaos_ativos from two rows', () => {
      const result = _aggregate([row1, row2]);
      expect(result.total_cidadaos_ativos).toBe(10173);
    });

    it('sums saidas from two rows', () => {
      const result = _aggregate([row1, row2]);
      expect(result.total_saidas).toBe(3607);
    });

    it('builds por_unidade with one entry per row', () => {
      const result = _aggregate([row1, row2]);
      expect(result.por_unidade).toHaveLength(2);
      expect(result.por_unidade[0].estabelecimento_id).toBe(5);
      expect(result.por_unidade[1].estabelecimento_id).toBe(6);
    });

    it('merges faixa_etaria bands by name (matching faixa summed)', () => {
      const result = _aggregate([row1, row2]);
      const menos1 = result.faixa_etaria.find((b) => b.faixa === 'Menos de 01 ano');
      expect(menos1).toBeDefined();
      expect(menos1.masculino).toBe(31);  // 20 + 11
      expect(menos1.feminino).toBe(26);   // 15 + 11
    });

    it('keeps non-matching faixa bands separate', () => {
      const result = _aggregate([row1, row2]);
      const faixas = result.faixa_etaria.map((b) => b.faixa);
      expect(faixas).toContain('01 ano');
      expect(faixas).toContain('02 anos');
    });

    it('sums condicoes_saude.gestante.sim across units', () => {
      const result = _aggregate([row1, row2]);
      expect(result.condicoes_saude.gestante.sim).toBe(24); // 14 + 10
    });

    it('sums condicoes_saude.gestante.nao across units', () => {
      const result = _aggregate([row1, row2]);
      expect(result.condicoes_saude.gestante.nao).toBe(284); // 150 + 134
    });

    it('sums condicoes_saude.gestante.nao_informado across units', () => {
      const result = _aggregate([row1, row2]);
      expect(result.condicoes_saude.gestante.nao_informado).toBe(3029); // 1500 + 1529
    });

    it('sums raca_cor by key', () => {
      const result = _aggregate([row1, row2]);
      expect(result.raca_cor.branca).toBe(2570);  // 1500 + 1070
    });

    it('extracts competencia as YYYY-MM from first row', () => {
      const result = _aggregate([row1]);
      expect(result.competencia).toBe('2026-01');
    });

    it('handles empty faixa_etaria gracefully', () => {
      const rowNoFaixa = { ...row1, faixa_etaria: null };
      const result = _aggregate([rowNoFaixa]);
      expect(result.faixa_etaria).toEqual([]);
    });

    it('handles empty condicoes_saude gracefully', () => {
      const rowNoCond = { ...row1, condicoes_saude: null };
      const result = _aggregate([rowNoCond]);
      expect(result.condicoes_saude).toEqual({});
    });
  });

  // ─── getPopulacao ─────────────────────────────────────────────────────────────

  describe('getPopulacao', () => {
    it('returns null when no rows found', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await getPopulacao({ competencia: '2026-01-01', estabelecimentoId: null });
      expect(result).toBeNull();
    });

    it('returns aggregated object when rows found', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            estabelecimento_id: 5,
            estabelecimento_nome: 'PSF JD Alvorada',
            competencia: '2026-01-01',
            cidadaos_ativos: 3337,
            saidas: 1198,
            importado_em: '2026-06-22T14:30:00Z',
            faixa_etaria: [],
            condicoes_saude: {},
            raca_cor: {},
          },
        ],
      });

      const result = await getPopulacao({ competencia: '2026-01-01', estabelecimentoId: null });
      expect(result).not.toBeNull();
      expect(result.total_cidadaos_ativos).toBe(3337);
    });

    it('returns por_unidade with one entry when estabelecimentoId provided', async () => {
      query.mockResolvedValueOnce({
        rows: [
          {
            estabelecimento_id: 5,
            estabelecimento_nome: 'PSF JD Alvorada',
            competencia: '2026-01-01',
            cidadaos_ativos: 3337,
            saidas: 1198,
            importado_em: '2026-06-22T14:30:00Z',
            faixa_etaria: [],
            condicoes_saude: {},
            raca_cor: {},
          },
        ],
      });

      const result = await getPopulacao({ competencia: '2026-01-01', estabelecimentoId: 5 });
      expect(result.por_unidade).toHaveLength(1);
      expect(result.por_unidade[0].estabelecimento_id).toBe(5);
    });

    it('passes competencia and estabelecimentoId as query params', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await getPopulacao({ competencia: '2026-01-01', estabelecimentoId: 5 });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('populacao_cadastrada'),
        ['2026-01-01', 5]
      );
    });

    it('omits estabelecimentoId param when not provided', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await getPopulacao({ competencia: '2026-01-01', estabelecimentoId: null });
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('populacao_cadastrada'),
        ['2026-01-01']
      );
    });
  });

  // ─── listPopulacaoCompetencias ───────────────────────────────────────────────

  describe('listPopulacaoCompetencias', () => {
    it('returns empty array when no data', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await listPopulacaoCompetencias();
      expect(result).toEqual([]);
    });

    it('returns array sorted descending by competencia', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { competencia: '2026-03', unidades_count: '2', total_cidadaos_ativos: '8000' },
          { competencia: '2026-01', unidades_count: '3', total_cidadaos_ativos: '10173' },
        ],
      });

      const result = await listPopulacaoCompetencias();
      expect(result).toHaveLength(2);
      expect(result[0].competencia).toBe('2026-03');
      expect(result[1].competencia).toBe('2026-01');
    });

    it('coerces numeric string values to numbers', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { competencia: '2026-01', unidades_count: '3', total_cidadaos_ativos: '10173' },
        ],
      });

      const result = await listPopulacaoCompetencias();
      expect(typeof result[0].unidades_count).toBe('number');
      expect(typeof result[0].total_cidadaos_ativos).toBe('number');
      expect(result[0].total_cidadaos_ativos).toBe(10173);
    });

    it('uses ORDER BY competencia DESC in the SQL query', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      await listPopulacaoCompetencias();
      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(/ORDER BY competencia DESC/i),
        expect.anything()
      );
    });
  });
});
