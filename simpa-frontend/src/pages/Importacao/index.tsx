import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchCargas } from '../../api/importacao';
import { useAuth } from '../../contexts/AuthContext';
import type { CargaEsus } from '../../types/contrato';
import { canEditImportMappings, CARGAS_UPDATED_EVENT } from '../../utils/importacaoView';
import { CadastroSyncBanner } from '../Cadastros/CadastroSyncBanner';
import { SiaProducaoSyncBanner } from '../Cadastros/SiaProducaoSyncBanner';
import { HistoricoCargas } from './HistoricoCargas';
import { MapeamentosPanel } from './MapeamentosPanel';
import { SihImportSection } from './SihImportSection';
import { UploadZone } from './UploadZone';

type ImportTab = 'importar' | 'mapeamentos';

export default function ImportacaoPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const showMapeamentos = canEditImportMappings(user?.perfil);
  const [tab, setTab] = useState<ImportTab>(() =>
    searchParams.get('tab') === 'mapeamentos' ? 'mapeamentos' : 'importar',
  );
  const initialMapeamentosQuery = searchParams.get('q') ?? '';
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
    if (searchParams.get('tab') === 'mapeamentos' && showMapeamentos) {
      setTab('mapeamentos');
    }
  }, [searchParams, showMapeamentos]);

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
        <h2 className="analytics-title">Importação de dados</h2>
        <p className="analytics-subtitle">
          e-SUS, SIA e SIHD — importe, sincronize e acompanhe o histórico
        </p>
      </div>

      {showMapeamentos ? (
        <nav className="import-subnav" aria-label="Importação" data-testid="import-subnav">
          <button
            type="button"
            className={`import-subnav-link${tab === 'importar' ? ' active' : ''}`}
            onClick={() => setTab('importar')}
            data-testid="import-tab-importar"
          >
            Importar
          </button>
          <button
            type="button"
            className={`import-subnav-link${tab === 'mapeamentos' ? ' active' : ''}`}
            onClick={() => setTab('mapeamentos')}
            data-testid="import-tab-mapeamentos"
          >
            Mapeamentos
          </button>
        </nav>
      ) : null}

      {tab === 'importar' ? (
        <>
          <UploadZone onUploadConcluido={carregar} />

          {loading ? (
            <div className="analytics-state">Carregando histórico…</div>
          ) : error ? (
            <div className="analytics-state analytics-state-error">{error}</div>
          ) : (
            <HistoricoCargas cargas={cargas} onAtualizar={carregar} />
          )}

          <hr className="import-section-divider" />
          <CadastroSyncBanner />

          <hr className="import-section-divider" />
          {showMapeamentos ? <SiaProducaoSyncBanner /> : null}

          <hr className="import-section-divider" />
          <SihImportSection />
        </>
      ) : (
        <MapeamentosPanel initialQuery={initialMapeamentosQuery} />
      )}
    </div>
  );
}
