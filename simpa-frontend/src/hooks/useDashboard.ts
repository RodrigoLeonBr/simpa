import { useEffect, useMemo, useState } from 'react';
import { fetchEquipes, fetchEstabelecimentos } from '../api/cadastros';
import { fetchDashboard } from '../api/dashboard';
import { useFilters } from './useFilters';
import type { ContratoDashboard, Unidade } from '../types/contrato';
import {
  buildEstabelecimentosPerfilQuery,
  mapEstabelecimentosToUnidades,
} from '../utils/estabelecimentosView';
import { isPainelCatalogReady } from '../utils/dashboardView';

export interface DashboardViewModel {
  data: ContratoDashboard;
  unidades: Unidade[];
}

export function useDashboard() {
  const { competencia, unidadeId, equipeId, painelPerfil } = useFilters();
  const [data, setData] = useState<ContratoDashboard | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [unidadesLoaded, setUnidadesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(
    () => `${painelPerfil}:${competencia}:${unidadeId ?? 'all'}:${equipeId ?? 'all'}`,
    [painelPerfil, competencia, unidadeId, equipeId],
  );

  const unidadeNomeMap = useMemo(
    () => new Map(unidades.map((item) => [item.id, item.nome])),
    [unidades],
  );

  useEffect(() => {
    let cancelled = false;

    setUnidadesLoaded(false);
    setUnidades([]);
    setData(null);
    setLoading(true);
    setError(null);

    fetchEstabelecimentos(buildEstabelecimentosPerfilQuery(painelPerfil))
      .then((result) => {
        if (!cancelled) {
          setUnidades(mapEstabelecimentosToUnidades(result.data));
          setUnidadesLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnidades([]);
          setUnidadesLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [painelPerfil]);

  useEffect(() => {
    if (unidadeId !== null && !unidadesLoaded) {
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      if (!isPainelCatalogReady(painelPerfil)) {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const unidadeNome = unidadeId ? unidadeNomeMap.get(unidadeId) : undefined;
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
  }, [filterKey, competencia, unidadeId, equipeId, unidadesLoaded, unidadeNomeMap, painelPerfil]);

  return { data, unidades, loading, error };
}
