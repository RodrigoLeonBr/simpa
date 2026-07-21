import { describe, expect, it } from 'vitest';
import {
  DETALHE_CODIGO_TO_GRUPO,
  LEITO_RESUMO_LABELS,
  LEITOS_DETALHE_CATALOG,
  LEITOS_RESUMO_KEYS,
  assertDetalheConsistente,
  formatVigenciaUi,
  parseVigenciaUi,
} from './leitosCatalog';

describe('leitosCatalog', () => {
  it('LEITOS_RESUMO_KEYS has 6 keys incl uti split', () => {
    expect(LEITOS_RESUMO_KEYS).toHaveLength(6);
    expect(LEITOS_RESUMO_KEYS).toContain('uti_adulto');
    expect(LEITOS_RESUMO_KEYS).toContain('uti_neonatal');
    expect(LEITOS_RESUMO_KEYS).not.toContain('uti');
  });

  it('LEITO_RESUMO_LABELS has a friendly label for every resumo key', () => {
    for (const key of LEITOS_RESUMO_KEYS) {
      expect(LEITO_RESUMO_LABELS[key]).toBeTruthy();
    }
    expect(LEITO_RESUMO_LABELS.uti_adulto).toBe('UTI Adulto');
    expect(LEITO_RESUMO_LABELS.uti_neonatal).toBe('UTI Neonatal');
  });

  it('LEITOS_DETALHE_CATALOG has the 10 canonical codes mapped to groups', () => {
    expect(LEITOS_DETALHE_CATALOG).toHaveLength(10);
    expect(DETALHE_CODIGO_TO_GRUPO['75']).toBe('uti_adulto');
    expect(DETALHE_CODIGO_TO_GRUPO['81']).toBe('uti_neonatal');
    expect(DETALHE_CODIGO_TO_GRUPO['03']).toBe('cirurgico');
    expect(DETALHE_CODIGO_TO_GRUPO['13']).toBe('cirurgico');
    expect(DETALHE_CODIGO_TO_GRUPO['33']).toBe('clinico');
    expect(DETALHE_CODIGO_TO_GRUPO['10']).toBe('obstetrico');
    expect(DETALHE_CODIGO_TO_GRUPO['43']).toBe('obstetrico');
    expect(DETALHE_CODIGO_TO_GRUPO['47']).toBe('clinico');
    expect(DETALHE_CODIGO_TO_GRUPO['68']).toBe('pediatrico');
    expect(DETALHE_CODIGO_TO_GRUPO['45']).toBe('pediatrico');
  });

  it('parseVigenciaUi maps MM/YYYY and 99/9999', () => {
    expect(parseVigenciaUi('10/2024', '99/9999')).toEqual({ inicio: '202410', fim: '999999' });
  });

  it('parseVigenciaUi throws on invalid format', () => {
    expect(() => parseVigenciaUi('2024-10', '99/9999')).toThrow();
    expect(() => parseVigenciaUi('10/2024', '9999')).toThrow();
  });

  it('formatVigenciaUi inverse of parse', () => {
    expect(formatVigenciaUi('202410', '999999')).toEqual({ inicio: '10/2024', fim: '99/9999' });
  });

  it('assertDetalheConsistente checks only groups present in detail', () => {
    const leitos = { uti_adulto: 17, uti_neonatal: 5, clinico: 44 };
    expect(assertDetalheConsistente(leitos, { '75': 17, '81': 5 })).toBeNull();
    expect(assertDetalheConsistente(leitos, { '75': 10 })).toMatch(/uti_adulto/i);
  });

  it('assertDetalheConsistente allows partial detailing (all zero/absent detail)', () => {
    const leitos = { clinico: 10 };
    expect(assertDetalheConsistente(leitos, {})).toBeNull();
    expect(assertDetalheConsistente(leitos, { '75': 0 })).toBeNull();
  });
});
