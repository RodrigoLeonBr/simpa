import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazy } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LazyModuleRoute } from './components/shared/ModuleLoadError';
import { NAV_ITEMS } from './config/navigation';
import { clearStoredSession, writeStoredSession } from './types/auth';

vi.mock('./pages/Painel/PopulacaoPage', () => ({
  default: () => <div data-testid="populacao-page">PopulacaoPage</div>,
}));

const MockPopulacaoPage = lazy(() => import('./pages/Painel/PopulacaoPage'));

function renderRoute(path: string, authenticated: boolean) {
  if (authenticated) {
    writeStoredSession({ token: 'tok', user: { username: 'u', nome: 'U', perfil: 'Admin' } });
  } else {
    clearStoredSession();
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>login-page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route
              path="/painel/populacao"
              element={<LazyModuleRoute Page={MockPopulacaoPage} />}
            />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('navigation.ts — /painel/populacao entry', () => {
  it('NAV_ITEMS includes entry with to="/painel/populacao"', () => {
    const item = NAV_ITEMS.find((n) => n.to === '/painel/populacao');
    expect(item).toBeDefined();
    expect(item?.label).toBe('População Cadastrada');
  });
});

describe('App routing — /painel/populacao', () => {
  afterEach(() => {
    cleanup();
    clearStoredSession();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    clearStoredSession();
  });

  it('unauthenticated user at /painel/populacao redirects to /login', () => {
    renderRoute('/painel/populacao', false);
    expect(screen.getByText('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('populacao-page')).toBeNull();
  });

  it('authenticated user at /painel/populacao renders PopulacaoPage', async () => {
    renderRoute('/painel/populacao', true);
    expect(await screen.findByTestId('populacao-page')).toBeInTheDocument();
    expect(screen.queryByText('login-page')).toBeNull();
  });

  it('route renders without crash for authenticated user', async () => {
    expect(() => renderRoute('/painel/populacao', true)).not.toThrow();
    expect(await screen.findByTestId('populacao-page')).toBeInTheDocument();
  });
});
