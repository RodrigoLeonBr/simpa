import { describe, expect, it } from 'vitest';
import type { ContratoDashboard } from '../../types/contrato';
import { buildModuleStatuses } from './moduleStatusView';

const d = (sia?: string, sihd?: string): ContratoDashboard =>
  ({ modulos: { ambulatorial_sia: { status_conexao: sia }, hospitalar_sihd: { status_importacao: sihd } } } as unknown as ContratoDashboard);

describe('buildModuleStatuses', () => {
  it('sia green when CONNECTED/ATIVO', () => {
    expect(buildModuleStatuses(d('CONNECTED', 'OK'))[0].tone).toBe('green');
    expect(buildModuleStatuses(d('ATIVO', 'OK'))[0]).toMatchObject({ tone: 'green', status: 'Conectado' });
  });
  it('sia red on UNAVAILABLE, amber otherwise', () => {
    expect(buildModuleStatuses(d('UNAVAILABLE', 'OK'))[0].tone).toBe('red');
    expect(buildModuleStatuses(d('WHATEVER_STATE', 'OK'))[0]).toMatchObject({ tone: 'amber', status: 'WHATEVER STATE' });
  });
  it('sihd tone PENDING→amber, OK→green, else red; defaults UNKNOWN→red', () => {
    expect(buildModuleStatuses(d('CONNECTED', 'PENDING_AIH_FILE'))[1]).toMatchObject({ tone: 'amber', status: 'Pendente' });
    expect(buildModuleStatuses(d('CONNECTED', 'OK'))[1].tone).toBe('green');
    expect(buildModuleStatuses(d())[1].tone).toBe('red'); // UNKNOWN
  });
});
