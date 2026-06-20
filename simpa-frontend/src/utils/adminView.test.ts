import { describe, expect, it } from 'vitest';
import {
  canAccessAdminModule,
  canManageAdminUsers,
  canReadAuditLog,
  formatAdminBoolean,
  formatAdminDate,
} from './adminView';

describe('adminView', () => {
  it('gates admin module access by perfil', () => {
    expect(canAccessAdminModule('Administrador')).toBe(true);
    expect(canAccessAdminModule('Planejamento')).toBe(true);
    expect(canAccessAdminModule('Gestor Secretaria')).toBe(false);
  });

  it('restricts user management to Administrador', () => {
    expect(canManageAdminUsers('Administrador')).toBe(true);
    expect(canManageAdminUsers('Planejamento')).toBe(false);
  });

  it('allows audit read for admin and planejamento', () => {
    expect(canReadAuditLog('Administrador')).toBe(true);
    expect(canReadAuditLog('Planejamento')).toBe(true);
    expect(canReadAuditLog('Gestor de Unidade')).toBe(false);
  });

  it('formats admin display values including invalid dates', () => {
    expect(formatAdminBoolean(true)).toBe('Sim');
    expect(formatAdminBoolean('nao')).toBe('Não');
    expect(formatAdminBoolean('false')).toBe('Não');
    expect(formatAdminDate(null)).toBe('—');
    expect(formatAdminDate('invalid-date')).toBe('invalid-date');
    expect(formatAdminDate('2026-05-01T12:00:00.000Z')).not.toBe('—');
  });
});
