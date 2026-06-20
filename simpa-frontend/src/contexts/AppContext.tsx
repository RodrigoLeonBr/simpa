import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getStoredTheme, setTheme, toggleTheme, type Theme } from '../utils/theme';

interface AppContextValue {
  theme: Theme;
  isSituacao: boolean;
  toggleAppTheme: () => void;
  openSituacao: () => void;
  closeSituacao: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());
  const [isSituacao, setIsSituacao] = useState(false);

  const toggleAppTheme = useCallback(() => {
    setThemeState(toggleTheme());
  }, []);

  const openSituacao = useCallback(() => {
    setIsSituacao(true);
  }, []);

  const closeSituacao = useCallback(() => {
    setIsSituacao(false);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      theme,
      isSituacao,
      toggleAppTheme,
      openSituacao,
      closeSituacao,
    }),
    [theme, isSituacao, toggleAppTheme, openSituacao, closeSituacao],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider');
  }
  return ctx;
}

export function setAppTheme(theme: Theme): void {
  setTheme(theme);
}
