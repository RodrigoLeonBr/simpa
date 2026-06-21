jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  canonicalCode,
  canonicalFormaFromSigtap,
  canonicalCboCode,
  resolveFormaDescricao,
  resolveCboDescricao,
} = require('../src/services/cadastroReferenciaService');

describe('cadastroReferenciaService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  describe('canonicalCode', () => {
    it('truncates prd_cbo-style 8-char values to 6', () => {
      expect(canonicalCode('22512500', 6)).toBe('225125');
    });

    it('left-pads short forma codes to 6 digits', () => {
      expect(canonicalCode('30101', 6)).toBe('030101');
    });

    it('returns null for empty values', () => {
      expect(canonicalCode('', 6)).toBeNull();
      expect(canonicalCode(null, 6)).toBeNull();
      expect(canonicalCode('   ', 6)).toBeNull();
    });
  });

  describe('canonicalFormaFromSigtap', () => {
    it('derives forma from full SIGTAP code', () => {
      expect(canonicalFormaFromSigtap('0301010072')).toBe('030101');
    });
  });

  describe('canonicalCboCode', () => {
    it('canonicalizes CBO with truncation or padding', () => {
      expect(canonicalCboCode('22512500')).toBe('225125');
      expect(canonicalCboCode('225125')).toBe('225125');
      expect(canonicalCboCode('5125')).toBe('005125');
    });
  });

  describe('resolveFormaDescricao', () => {
    it('returns description when cadastro exists', async () => {
      query.mockResolvedValueOnce({ rows: [{ descricao: 'CONSULTA MEDICA' }] });

      const descricao = await resolveFormaDescricao('0301010072');

      expect(descricao).toBe('CONSULTA MEDICA');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('FROM formas_sia'),
        ['030101']
      );
    });

    it('returns null when cadastro is missing', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const descricao = await resolveFormaDescricao('9999999999');

      expect(descricao).toBeNull();
    });

    it('returns null for empty code without querying', async () => {
      const descricao = await resolveFormaDescricao('');

      expect(descricao).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('resolveCboDescricao', () => {
    it('returns description when cadastro exists', async () => {
      query.mockResolvedValueOnce({ rows: [{ descricao: 'MEDICO CLINICO' }] });

      const descricao = await resolveCboDescricao('22512500');

      expect(descricao).toBe('MEDICO CLINICO');
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('FROM cbos_sia'),
        ['225125']
      );
    });

    it('returns null when cadastro is missing', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const descricao = await resolveCboDescricao('99999999');

      expect(descricao).toBeNull();
    });
  });
});
