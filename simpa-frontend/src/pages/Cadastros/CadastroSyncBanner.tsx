import { useCallback, useEffect, useState } from 'react';
import {
  fetchUltimaCadastroSync,
  sincronizarCadastros,
} from '../../api/cadastros';
import type { CadastroSyncRecord, CadastroSyncResult } from '../../types/cadastros';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import { formatImportDate } from '../../utils/importacaoView';

function isMysqlUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('mysql') ||
    lower.includes('xampp') ||
    lower.includes('502') ||
    lower.includes('unavailable')
  );
}

function formatSyncToast(result: CadastroSyncResult): string {
  const e = result.estabelecimentos;
  const p = result.procedimentos;
  return `Cadastros atualizados — ${e.inserted + e.updated} estabelecimentos, ${p.inserted + p.updated} procedimentos`;
}

export function CadastroSyncBanner() {
  const [ultima, setUltima] = useState<CadastroSyncRecord | null>(null);
  const [loadingUltima, setLoadingUltima] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [degraded, setDegraded] = useState<string | null>(null);
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
      const resultado = await sincronizarCadastros();

      if (resultado.status === 'erro') {
        const msg = resultado.error ?? 'Falha na sincronização com MySQL/XAMPP';
        setDegraded(
          'MySQL/XAMPP indisponível. Exibindo última sincronização conhecida.',
        );
        showToast(msg);
        return;
      }

      if (resultado.status === 'parcial') {
        const msg =
          resultado.error ??
          'Sincronização concluída com registros ignorados por dados inválidos.';
        setDegraded(msg);
        showToast(formatSyncToast(resultado));
        await carregarUltima();
        return;
      }

      showToast(formatSyncToast(resultado));
      await carregarUltima();
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
    </>
  );
}
