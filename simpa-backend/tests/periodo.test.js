const { resolvePeriodo, getPreviousPeriodo } = require('../src/services/periodo');

describe('periodo', () => {
  describe('resolvePeriodo', () => {
    it('mês YYYY-MM → intervalo de um mês', () => {
      expect(resolvePeriodo('2026-05')).toEqual({
        tipo: 'mes',
        ano: 2026,
        indice: 5,
        inicio: '2026-05',
        fim: '2026-05',
        meses: ['2026-05'],
        competencia: '2026-05',
      });
    });

    it('trimestre YYYY-Tn → 3 meses', () => {
      const p = resolvePeriodo('2026-T2');
      expect(p.tipo).toBe('trimestre');
      expect(p.meses).toEqual(['2026-04', '2026-05', '2026-06']);
      expect(p.inicio).toBe('2026-04');
      expect(p.fim).toBe('2026-06');
      expect(p.competencia).toBe('2026-06');
    });

    it('quadrimestre YYYY-Qn → 4 meses', () => {
      const p = resolvePeriodo('2026-Q2');
      expect(p.tipo).toBe('quadrimestre');
      expect(p.meses).toEqual(['2026-05', '2026-06', '2026-07', '2026-08']);
      expect(p.inicio).toBe('2026-05');
      expect(p.fim).toBe('2026-08');
    });

    it('ano YYYY → 12 meses', () => {
      const p = resolvePeriodo('2026');
      expect(p.tipo).toBe('ano');
      expect(p.meses).toHaveLength(12);
      expect(p.inicio).toBe('2026-01');
      expect(p.fim).toBe('2026-12');
    });

    it('rejeita índice fora do intervalo (T5)', () => {
      expect(() => resolvePeriodo('2026-T5')).toThrow();
    });

    it('rejeita formato inválido', () => {
      expect(() => resolvePeriodo('2026/05')).toThrow();
    });
  });

  describe('getPreviousPeriodo', () => {
    it('mês → mês anterior (mesmo ano)', () => {
      expect(getPreviousPeriodo('2026-05')).toBe('2026-04');
    });
    it('mês janeiro → dezembro ano anterior', () => {
      expect(getPreviousPeriodo('2026-01')).toBe('2025-12');
    });
    it('trimestre T2 → T1', () => {
      expect(getPreviousPeriodo('2026-T2')).toBe('2026-T1');
    });
    it('trimestre T1 → T4 ano anterior', () => {
      expect(getPreviousPeriodo('2026-T1')).toBe('2025-T4');
    });
    it('quadrimestre Q1 → Q3 ano anterior', () => {
      expect(getPreviousPeriodo('2026-Q1')).toBe('2025-Q3');
    });
    it('ano → ano anterior', () => {
      expect(getPreviousPeriodo('2026')).toBe('2025');
    });
  });
});
