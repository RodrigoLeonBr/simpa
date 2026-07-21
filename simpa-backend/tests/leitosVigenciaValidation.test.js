const {
  normalizeLeitosResumo,
  validateVigenciaPayload,
  rangesOverlap,
  assertDetalheConsistente,
} = require('../src/services/leitosVigenciaValidation');

describe('leitosVigenciaValidation', () => {
  it('normalizeLeitosResumo maps uti → uti_adulto', () => {
    expect(normalizeLeitosResumo({ uti: 10, clinico: 1 })).toEqual({
      clinico: 1,
      uti_adulto: 10,
    });
  });

  it('rangesOverlap detects adjacent as non-overlap and crossing as overlap', () => {
    expect(rangesOverlap('202101', '202306', '202307', '202409')).toBe(false);
    expect(rangesOverlap('202101', '202306', '202306', '202409')).toBe(true);
  });

  it('assertDetalheConsistente requires group sums to match when detail used', () => {
    const leitos = {
      clinico: 44,
      cirurgico: 47,
      obstetrico: 22,
      pediatrico: 8,
      uti_adulto: 17,
      uti_neonatal: 5,
    };
    const ok = {
      '33': 44,
      '03': 30,
      '13': 17,
      '10': 13,
      '43': 9,
      '45': 6,
      '68': 2,
      '75': 17,
      '81': 5,
      '47': 0,
    };
    expect(assertDetalheConsistente(leitos, ok)).toBeNull();
    expect(assertDetalheConsistente(leitos, { '75': 10 })).toMatch(/uti_adulto/i);
  });

  it('validateVigenciaPayload rejects unknown detail code and bad YYYYMM', () => {
    const bad = validateVigenciaPayload({
      vigencia_inicio: '202413',
      vigencia_fim: '999999',
      leitos: { clinico: 1 },
      leitos_detalhe: {},
    });
    expect(bad.ok).toBe(false);

    const unknown = validateVigenciaPayload({
      vigencia_inicio: '202410',
      vigencia_fim: '999999',
      leitos: { clinico: 1 },
      leitos_detalhe: { '99': 1 },
    });
    expect(unknown.ok).toBe(false);
  });
});
