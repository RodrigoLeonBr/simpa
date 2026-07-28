import { useCallback, useEffect, useState } from 'react';
import {
  fetchUltimaCadastroSync,
  computarSyncPlano,
  aplicarSyncPlano,
} from '../../api/cadastros';
import type { CadastroSyncRecord, SyncPlano } from '../../types/cadastros';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import { formatImportDate } from '../../utils/importacaoView';
import { SyncPlanoPreview } from './SyncPlanoPreview';

function isMysqlUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('mysql') ||
    lower.includes('xampp') ||
    lower.includes('502') ||
    lower.includes('unavailable')
  );
}


export function CadastroSyncBanner() {
  const [ultima, setUltima] = useState<CadastroSyncRecord | null>(null);
  const [loadingUltima, setLoadingUltima] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [degraded, setDegraded] = useState<string | null>(null);
  const [plano, setPlano] = useState<SyncPlano | null>(null);
  const { toast, showToast } = useToast();

  const carregarUltima = useCallback(async () => {
    try {
      const registro = await fetchUltimaCadastroSync();
      setUltima(registro);
    } catch {
      setUltima(null);
    } finally {
      setLoadingUltima(false);
    }
  }, []);

  useEffect(() => {
    void carregarUltima();
  }, [carregarUltima]);

  const handleSync = async () => {
    setSyncing(true);
    setDegraded(null);

    try {
      const p = await computarSyncPlano();
      const { estabelecimentos: re, procedimentos: rp } = p.resumo;
      const total = re.novo + re.alterado + re.sumiu + rp.novo + rp.alterado + rp.sumiu;
      if (total === 0) {
        showToast('Nada a alterar — cadastros já em dia');
      } else {
        setPlano(p);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha na sincronização';
      if (isMysqlUnavailableError(msg)) {
        setDegraded(
          'MySQL/XAMPP indisponível. Exibindo última sincronização conhecida.',
        );
      }
      showToast(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleAplicar = async (itens: Parameters<typeof aplicarSyncPlano>[0]) => {
    if (itens.length === 0) { setPlano(null); return; }
    try {
      const r = await aplicarSyncPlano(itens);
      showToast(`${r.aplicados} aplicados, ${r.pulados} pulados`);
    } catch (err) {
      setDegraded(err instanceof Error ? err.message : 'Falha ao aplicar');
    } finally {
      setPlano(null);
      void carregarUltima();
    }
  };

  return (
    <>
      <section className="card cadastro-sync-banner" data-testid="cadastro-sync-banner">
        <div className="cadastro-sync-banner-main">
          <div>
            <h3 className="cadastro-sync-title">Espelho SIA · MySQL/XAMPP</h3>
            <p className="cadastro-sync-desc">
              Estabelecimentos e procedimentos são sincronizados a partir do banco local.
            </p>
          </div>
          <button
            type="button"
            className="cadastro-btn primary"
            disabled={syncing}
            data-testid="cadastro-sync-button"
            onClick={() => void handleSync()}
          >
            {syncing ? 'Sincronizando…' : 'Atualizar cadastros do SIA'}
          </button>
        </div>

        {degraded ? (
          <p className="analytics-state analytics-state-error cadastro-sync-degraded" role="alert">
            {degraded}
          </p>
        ) : null}

        <div className="cadastro-sync-meta mono" data-testid="cadastro-sync-ultima">
          {loadingUltima ? (
            'Carregando última sincronização…'
          ) : ultima ? (
            <>
              Última sync: {formatImportDate(ultima.sincronizado_em)} ·{' '}
              {ultima.estabelecimentos.inserted + ultima.estabelecimentos.updated} estab. ·{' '}
              {ultima.procedimentos.inserted + ultima.procedimentos.updated} proc.
            </>
          ) : (
            'Nenhuma sincronização registrada ainda.'
          )}
        </div>
      </section>

      <ToastBanner message={toast.message} visible={toast.visible} />

      {plano && (
        <SyncPlanoPreview
          plano={plano}
          onAplicar={handleAplicar}
          onCancelar={() => setPlano(null)}
        />
      )}
    </>
  );
}
