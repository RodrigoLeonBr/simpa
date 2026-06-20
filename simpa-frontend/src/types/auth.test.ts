import { afterEach, describe, expect, it } from 'vitest';
import {
  AUTH_STORAGE_KEY,
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type AuthSession,
} from './auth';

const validSession: AuthSession = {
  token: 'jwt-123',
  user: { username: 'admin', nome: 'Admin', perfil: 'Administrador' },
};

describe('auth storage helpers', () => {
  afterEach(() => {
    clearStoredSession();
  });

  it('readStoredSession returns null when storage is empty', () => {
    expect(readStoredSession()).toBeNull();
  });

  it('writeStoredSession persists and readStoredSession reads back', () => {
    writeStoredSession(validSession);
    expect(readStoredSession()).toEqual(validSession);
  });

  it('readStoredSession removes invalid JSON', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{bad-json');
    expect(readStoredSession()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it('readStoredSession rejects session without token', () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({ user: { username: 'admin', nome: 'Admin', perfil: 'Administrador' } }),
    );
    expect(readStoredSession()).toBeNull();
  });

  it('clearStoredSession removes persisted session', () => {
    writeStoredSession(validSession);
    clearStoredSession();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
