import { useEffect, useState } from 'react';
import { fetchDashboard } from '../api/dashboard';
import { useFilters } from './useFilters';
import type { ContratoDashboard } from '../types/contrato';

export function useDashboard() {
  const { competencia, unidade, equipe } = useFilters();
  const [data, setData]     = useState<ContratoDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchDashboard(competencia, unidade || undefined, equipe || undefined)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [competencia, unidade, equipe]);

  return { data, loading, error };
}
