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
import { periodoFimCompetencia } from '../utils/periodo';

export interface FiltersState {
  periodo: string;
  competencia: string;
  unidadeId: number | null;
  equipeId: number | null;
  painelPerfil: PainelPerfil;
}

export interface FiltersContextValue extends FiltersState {
  competencias: string[];
  setPeriodo: (value: string) => void;
  setCompetencia: (value: string) => void;
  setUnidadeId: (value: number | null) => void;
  setEquipeId: (value: number | null) => void;
  setPainelPerfil: (value: PainelPerfil) => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [periodo, setPeriodo] = useState(DEFAULT_COMPETENCIAS[0]!);
  const [unidadeId, setUnidadeIdState] = useState<number | null>(null);
  const [equipeId, setEquipeIdState] = useState<number | null>(null);
  const [painelPerfil, setPainelPerfilState] = useState<PainelPerfil>('APS');

  // competência mensal derivada (mês final do período) — páginas não-Painel seguem mensais.
  const competencia = periodoFimCompetencia(periodo);
  // Alias legado: definir competência = definir período mensal.
  const setCompetencia = setPeriodo;

  useEffect(() => {
    fetchCompetenciaPadrao()
      .then((valor) => {
        if (DEFAULT_COMPETENCIAS.includes(valor)) {
          setPeriodo(valor);
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
      periodo,
      competencia,
      unidadeId,
      equipeId,
      painelPerfil,
      competencias: DEFAULT_COMPETENCIAS,
      setPeriodo,
      setCompetencia,
      setUnidadeId,
      setEquipeId,
      setPainelPerfil,
    }),
    [periodo, competencia, unidadeId, equipeId, painelPerfil, setCompetencia, setUnidadeId, setEquipeId, setPainelPerfil],
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
