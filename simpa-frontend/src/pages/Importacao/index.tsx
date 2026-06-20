import { useCallback, useEffect, useState } from 'react';
import { fetchCargas } from '../../api/importacao';
import type { CargaEsus } from '../../types/contrato';
import { CARGAS_UPDATED_EVENT } from '../../utils/importacaoView';
import { HistoricoCargas } from './HistoricoCargas';
import { UploadZone } from './UploadZone';

export default function ImportacaoPage() {
  const [cargas, setCargas] = useState<CargaEsus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const dados = await fetchCargas();
      setCargas(dados);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar histórico');
      setCargas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = () => {
      void carregar();
    };

    load();
    window.addEventListener(CARGAS_UPDATED_EVENT, load);
    return () => window.removeEventListener(CARGAS_UPDATED_EVENT, load);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial history fetch on mount
  }, [carregar]);

  return (
    <div className="import-page simpa-rise" data-testid="importacao-page">
      <div className="analytics-header">
        <h2 className="analytics-title">Importação e-SUS</h2>
        <p className="analytics-subtitle">
          Envie relatórios CSV, confira o preview detectado e acompanhe o histórico de cargas
        </p>
      </div>

      <UploadZone />

      {loading ? (
        <div className="analytics-state">Carregando histórico…</div>
      ) : error ? (
        <div className="analytics-state analytics-state-error">{error}</div>
      ) : (
        <HistoricoCargas cargas={cargas} onAtualizar={carregar} />
      )}
    </div>
  );
}
