import { describe, expect, it } from 'vitest';
import mockDb from '../../mock/db.json';
import type { ContratoDashboard } from './contrato';

describe('ContratoDashboard fixture typing', () => {
  it('compiles against mock fixture with indicadores_qualidade', () => {
    const payload = mockDb.planejamento[0] as ContratoDashboard;

    expect(payload.versao_schema).toBe('3.1.0');
    expect(payload.competencia).toBe('2026-05');
    expect(payload.indicadores_qualidade.length).toBeGreaterThan(0);
    expect(payload.indicadores_qualidade[0].cod).toBe('C1');
    expect(payload.modulos.ambulatorial_sia.status_conexao).toBe(
      'MySQL_XAMPP_CONNECTED',
    );
  });
});
