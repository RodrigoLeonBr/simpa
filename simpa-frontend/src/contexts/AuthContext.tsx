import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { loginRequest, logoutRequest } from '../api/auth';
import { setTokenProvider, setUnauthorizedHandler } from '../api/client';
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
  type AuthSession,
  type AuthUser,
} from '../types/auth';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (username: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());

  const logout = useCallback(async () => {
    if (session?.token) {
      await logoutRequest(session.token);
    }
    clearStoredSession();
    setSession(null);
  }, [session?.token]);

  const login = useCallback(async (username: string, senha: string) => {
    const next = await loginRequest(username, senha);
    writeStoredSession(next);
    setSession(next);
  }, []);

  useEffect(() => {
    setTokenProvider(() => session?.token ?? null);
    return () => setTokenProvider(null);
  }, [session?.token]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStoredSession();
      setSession(null);
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: session?.token ?? null,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session?.token),
      login,
      logout,
    }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
