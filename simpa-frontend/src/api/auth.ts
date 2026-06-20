import type { AuthSession, AuthUser } from '../types/auth';
import { apiBase } from './client';

export async function loginRequest(
  username: string,
  senha: string,
): Promise<AuthSession> {
  const res = await fetch(`${apiBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, senha }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((body as { error?: string }).error || 'Credenciais inválidas');
  }

  return body as AuthSession;
}

export async function meRequest(token: string): Promise<AuthUser> {
  const res = await fetch(`${apiBase()}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Sessão inválida');
  }

  return res.json() as Promise<AuthUser>;
}

export async function logoutRequest(token: string): Promise<void> {
  await fetch(`${apiBase()}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => undefined);
}
