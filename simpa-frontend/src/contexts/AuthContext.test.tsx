import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { AUTH_STORAGE_KEY } from '../types/auth';
import { apiFetch } from '../api/client';

function AuthProbe() {
  const { token, user, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="token">{token || 'none'}</div>
      <div data-testid="user">{user?.username || 'none'}</div>
      <button type="button" onClick={() => login('admin', 'simpa@2026')}>
        login
      </button>
      <button type="button" onClick={() => logout()}>
        logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('login() stores token and user in localStorage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          token: 'jwt-123',
          user: { username: 'admin', nome: 'Admin', perfil: 'Administrador' },
        }),
      }),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => {
      expect(screen.getByTestId('token')).toHaveTextContent('jwt-123');
      expect(screen.getByTestId('user')).toHaveTextContent('admin');
    });

    const stored = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
    expect(stored.token).toBe('jwt-123');
    expect(stored.user.username).toBe('admin');
  });

  it('logout() clears storage', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'jwt-123',
        user: { username: 'admin', nome: 'Admin', perfil: 'Administrador' },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      }),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('token')).toHaveTextContent('jwt-123');

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => {
      expect(screen.getByTestId('token')).toHaveTextContent('none');
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });
  });

  it('useAuth throws outside AuthProvider', () => {
    function BrokenConsumer() {
      useAuth();
      return null;
    }

    expect(() => render(<BrokenConsumer />)).toThrow('useAuth must be used within AuthProvider');
  });

  it('clears session when apiFetch receives 401', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'jwt-123',
        user: { username: 'admin', nome: 'Admin', perfil: 'Administrador' },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized' }),
      }),
    );

    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('token')).toHaveTextContent('jwt-123');

    await expect(apiFetch('/dashboard')).rejects.toThrow('Unauthorized');

    await waitFor(() => {
      expect(screen.getByTestId('token')).toHaveTextContent('none');
      expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    });
  });
});
