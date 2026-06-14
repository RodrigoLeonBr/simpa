import React, { createContext, useContext, useState } from 'react';

type PeriodoTipo = 'mes' | 'quadrimestre' | 'ano';

interface Filtros {
  competencia: string;     // YYYY-MM
  periodoTipo: PeriodoTipo;
  unidade: string;         // '' = todas
  equipe: string;          // '' = todas
}

interface FiltersCtx extends Filtros {
  setCompetencia: (v: string) => void;
  setPeriodoTipo: (v: PeriodoTipo) => void;
  setUnidade: (v: string) => void;
  setEquipe: (v: string) => void;
}

const FiltersContext = createContext<FiltersCtx | null>(null);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [competencia, setCompetencia] = useState('2026-05');
  const [periodoTipo, setPeriodoTipo]  = useState<PeriodoTipo>('mes');
  const [unidade, setUnidade]          = useState('');
  const [equipe, setEquipe]            = useState('');

  // Quando unidade muda para '', limpa equipe (cascata)
  function handleSetUnidade(v: string) {
    setUnidade(v);
    if (!v) setEquipe('');
  }

  return (
    <FiltersContext.Provider value={{
      competencia, setCompetencia,
      periodoTipo, setPeriodoTipo,
      unidade, setUnidade: handleSetUnidade,
      equipe,  setEquipe,
    }}>
      {children}
    </FiltersContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be inside FiltersProvider');
  return ctx;
}
