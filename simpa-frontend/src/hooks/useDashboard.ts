import { useEffect, useMemo, useState } from 'react';
import { fetchEstabelecimentos } from '../api/cadastros';
import { fetchDashboard } from '../api/dashboard';
import { useFilters } from './useFilters';
import type { ContratoDashboard, Unidade } from '../types/contrato';
import {
  buildEstabelecimentosPerfilQuery,
  mapEstabelecimentosToUnidades,
} from '../utils/estabelecimentosView';
import { needsConsolidatedDashboard } from '../utils/dashboardView';
import type { PainelLayout } from '../utils/painel/types';

export interface DashboardViewModel {
  data: ContratoDashboard;
  unidades: Unidade[];
}

export function buildDashboardFilters(
  unidadeId: number | null,
  equipeId: number | null,
): { estabelecimentoId: number; equipeId?: number } | undefined {
  if (unidadeId == null) {
    return undefined;
  }
  if (equipeId == null) {
    return { estabelecimentoId: unidadeId };
  }
  return { estabelecimentoId: unidadeId, equipeId };
}

export function useDashboard(options?: { layout?: PainelLayout }) {
  const layout = options?.layout ?? 'A';
  const { competencia, unidadeId, equipeId, painelPerfil } = useFilters();
  const [data, setData] = useState<ContratoDashboard | null>(null);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = useMemo(
    () => `${layout}:${painelPerfil}:${competencia}:${unidadeId ?? 'all'}:${equipeId ?? 'all'}`,
    [layout, painelPerfil, competencia, unidadeId, equipeId],
  );

  useEffect(() => {
    let cancelled = false;

    setUnidades([]);
    setData(null);
    setLoading(true);
    setError(null);

    fetchEstabelecimentos(buildEstabelecimentosPerfilQuery(painelPerfil))
      .then((result) => {
        if (!cancelled) {
          setUnidades(mapEstabelecimentosToUnidades(result.data));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUnidades([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [painelPerfil]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      if (!needsConsolidatedDashboard(painelPerfil, layout)) {
        if (!cancelled) {
          setData(null);
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const filters = buildDashboardFilters(unidadeId, equipeId);
        const payload = await fetchDashboard(competencia, filters);

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
  }, [filterKey, competencia, unidadeId, equipeId, painelPerfil, layout]);

  return { data, unidades, loading, error };
}
