import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_COMPETENCIAS } from '../config/navigation';

export interface FiltersState {
  competencia: string;
  unidadeId: number | null;
  equipeId: number | null;
}

export interface FiltersContextValue extends FiltersState {
  competencias: string[];
  setCompetencia: (value: string) => void;
  setUnidadeId: (value: number | null) => void;
  setEquipeId: (value: number | null) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [competencia, setCompetencia] = useState(DEFAULT_COMPETENCIAS[0]!);
  const [unidadeId, setUnidadeIdState] = useState<number | null>(null);
  const [equipeId, setEquipeIdState] = useState<number | null>(null);

  const setUnidadeId = useCallback((value: number | null) => {
    setUnidadeIdState(value);
    setEquipeIdState(null);
  }, []);

  const setEquipeId = useCallback((value: number | null) => {
    setEquipeIdState(value);
  }, []);

  const value = useMemo<FiltersContextValue>(
    () => ({
      competencia,
      unidadeId,
      equipeId,
      competencias: DEFAULT_COMPETENCIAS,
      setCompetencia,
      setUnidadeId,
      setEquipeId,
    }),
    [competencia, unidadeId, equipeId],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) {
    throw new Error('useFilters must be used within FiltersProvider');
  }
  return ctx;
}
