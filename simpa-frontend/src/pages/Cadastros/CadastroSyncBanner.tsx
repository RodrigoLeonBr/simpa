import { useCallback, useEffect, useState } from 'react';
import {
  fetchUltimaCadastroSync,
  computarSyncPlano,
  aplicarSyncPlano,
  sincronizarCadastros,
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
  const [syncingRefs, setSyncingRefs] = useState(false);
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

  const handleSyncRefs = async () => {
    setSyncingRefs(true);
    try {
      const r = await sincronizarCadastros();
      if (r.status === 'ok') {
        const total =
          (r.formas?.inserted ?? 0) + (r.formas?.updated ?? 0) +
          (r.cbos?.inserted ?? 0) + (r.cbos?.updated ?? 0) +
          (r.rubricas?.inserted ?? 0) + (r.rubricas?.updated ?? 0);
        showToast(
          total > 0
            ? `Tabelas de referência atualizadas (${total} registros)`
            : 'Tabelas de referência já em dia',
        );
      } else {
        showToast(r.error ?? 'Falha ao atualizar referências');
      }
      void carregarUltima();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao atualizar referências');
    } finally {
      setSyncingRefs(false);
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
          <button
            type="button"
            className="cadastro-btn secondary"
            disabled={syncingRefs}
            data-testid="cadastro-sync-refs-button"
            onClick={() => void handleSyncRefs()}
          >
            {syncingRefs ? 'Atualizando…' : 'Atualizar tabelas SIGTAP (forma/CBO/rubrica)'}
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
