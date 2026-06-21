import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPainelLayout } from '../api/painelWidgets';
import type { PainelLayoutResponse } from '../types/painelWidgets';
import { useFilters } from './useFilters';
import { buildDashboardFilters } from './useDashboard';

function toFriendlyError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('404') || normalized.includes('não encontrado')) {
    return 'Layout dinâmico não encontrado para os filtros informados';
  }

  return 'Falha ao carregar layout dinâmico do painel';
}

export function usePainelLayout(layoutId: 'A' = 'A') {
  const { competencia, unidadeId, equipeId, painelPerfil } = useFilters();
  const [layout, setLayout] = useState<PainelLayoutResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(painelPerfil === 'APS');
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const filterKey = useMemo(
    () => `${layoutId}:${painelPerfil}:${competencia}:${unidadeId ?? 'all'}:${equipeId ?? 'all'}`,
    [layoutId, painelPerfil, competencia, unidadeId, equipeId]
  );

  const refetch = useCallback(() => {
    setReloadTick((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadLayout() {
      if (painelPerfil !== 'APS') {
        if (!cancelled) {
          setLayout(null);
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const idFilters = buildDashboardFilters(unidadeId, equipeId);
        const payload = await fetchPainelLayout({
          competencia,
          perfil: painelPerfil,
          layout: layoutId,
          estabelecimentoId: idFilters?.estabelecimentoId,
          equipeId: idFilters?.equipeId,
        });

        if (!cancelled) {
          setLayout(payload);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Erro desconhecido';
          setError(toFriendlyError(message));
          setLayout(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLayout();

    return () => {
      cancelled = true;
    };
  }, [filterKey, reloadTick, competencia, unidadeId, equipeId, painelPerfil, layoutId]);

  return { layout, loading, error, refetch };
}
