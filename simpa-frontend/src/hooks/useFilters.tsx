import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchCompetenciaPadrao } from '../api/config';
import { DEFAULT_COMPETENCIAS } from '../config/navigation';
import type { PainelPerfil } from '../types/painel';

export interface FiltersState {
  competencia: string;
  unidadeId: number | null;
  equipeId: number | null;
  painelPerfil: PainelPerfil;
}

export interface FiltersContextValue extends FiltersState {
  competencias: string[];
  setCompetencia: (value: string) => void;
  setUnidadeId: (value: number | null) => void;
  setEquipeId: (value: number | null) => void;
  setPainelPerfil: (value: PainelPerfil) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [competencia, setCompetencia] = useState(DEFAULT_COMPETENCIAS[0]!);
  const [unidadeId, setUnidadeIdState] = useState<number | null>(null);
  const [equipeId, setEquipeIdState] = useState<number | null>(null);
  const [painelPerfil, setPainelPerfilState] = useState<PainelPerfil>('APS');

  useEffect(() => {
    fetchCompetenciaPadrao()
      .then((valor) => {
        if (DEFAULT_COMPETENCIAS.includes(valor)) {
          setCompetencia(valor);
        }
      })
      .catch(() => {
        // mantém default hardcoded se config indisponível
      });
  }, []);

  const setUnidadeId = useCallback((value: number | null) => {
    setUnidadeIdState(value);
    setEquipeIdState(null);
  }, []);

  const setEquipeId = useCallback((value: number | null) => {
    setEquipeIdState(value);
  }, []);

  const setPainelPerfil = useCallback((value: PainelPerfil) => {
    setPainelPerfilState(value);
    setUnidadeIdState(null);
    setEquipeIdState(null);
  }, []);

  const value = useMemo<FiltersContextValue>(
    () => ({
      competencia,
      unidadeId,
      equipeId,
      painelPerfil,
      competencias: DEFAULT_COMPETENCIAS,
      setCompetencia,
      setUnidadeId,
      setEquipeId,
      setPainelPerfil,
    }),
    [competencia, unidadeId, equipeId, painelPerfil, setUnidadeId, setEquipeId, setPainelPerfil],
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
