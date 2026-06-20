import { useEffect, useMemo, useState } from 'react';
import { fetchEquipes, fetchUnidades } from '../api/cadastros';
import { fetchDashboard } from '../api/dashboard';
import { useFilters } from './useFilters';
import type { ContratoDashboard, Unidade } from '../types/contrato';

export interface DashboardViewModel {
  data: ContratoDashboard;
  unidades: Unidade[];
}

export function useDashboard() {
  const { competencia, unidadeId, equipeId } = useFilters();
  const [data, setData] = useState<ContratoDashboard | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(
    () => `${competencia}:${unidadeId ?? 'all'}:${equipeId ?? 'all'}`,
    [competencia, unidadeId, equipeId],
  );

  useEffect(() => {
    fetchUnidades()
      .then(setUnidades)
      .catch(() => setUnidades([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const unidadeNome = unidadeId
          ? unidades.find((item) => item.id === unidadeId)?.nome
          : undefined;
        let equipeNome: string | undefined;

        if (equipeId && unidadeId) {
          const equipes = await fetchEquipes(unidadeId);
          equipeNome = equipes.find((item) => item.id === equipeId)?.nome;
        }

        const payload = await fetchDashboard(competencia, unidadeNome, equipeNome);

        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar painel');
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [filterKey, competencia, unidadeId, equipeId, unidades.length]);

  return { data, unidades, loading, error };
}
