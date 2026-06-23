import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchSiaSincronizacaoExiste,
  fetchSiaSincronizacoes,
  sincronizarSiaProducao,
} from '../../api/sia';
import type { SiaSyncExistsResponse, SiaSyncRecord, SiaSyncResult } from '../../types/sia';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import { formatImportDate } from '../../utils/importacaoView';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';

function defaultCompetencia(): string {
  const now = new Date();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = previousMonth.getFullYear();
  const month = String(previousMonth.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function isMysqlUnavailableError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('mysql') ||
    lower.includes('xampp') ||
    lower.includes('connection refused') ||
    lower.includes('unavailable')
  );
}

function isConflictError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('409') || lower.includes('já importada');
}

function formatResultToast(result: SiaSyncResult): string {
  const aggregatedRows = result.registros ?? 0;
  return `Importação SIA concluída — ${aggregatedRows} linhas agregadas.`;
}

export function SiaProducaoSyncBanner() {
  const [competencia, setCompetencia] = useState(defaultCompetencia);
  const [syncing, setSyncing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<SiaSyncRecord[]>([]);
  const [degraded, setDegraded] = useState<string | null>(null);
  const [existeInfo, setExisteInfo] = useState<SiaSyncExistsResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast, showToast } = useToast();

  const carregarHistorico = useCallback(async () => {
    try {
      const items = await fetchSiaSincronizacoes();
      setHistory(items);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const consultarCompetencia = useCallback(async (comp: string) => {
    try {
      const result = await fetchSiaSincronizacaoExiste(comp);
      setExisteInfo(result);
    } catch {
      setExisteInfo(null);
    }
  }, []);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  useEffect(() => {
    void consultarCompetencia(competencia);
  }, [competencia, consultarCompetencia]);

  const recentHistory = useMemo(() => history.slice(0, 6), [history]);

  const runSync = async (reimportar: boolean) => {
    setSyncing(true);
    setDegraded(null);
    try {
      const result = await sincronizarSiaProducao(competencia, { reimportar });

      if (result.status === 'erro') {
        const msg = result.error ?? 'Falha na importação de produção SIA.';
        if (isMysqlUnavailableError(msg)) {
          setDegraded('MySQL/XAMPP indisponível. Exibindo histórico de produção SIA.');
        }
        showToast(msg);
        return;
      }

      if (result.status === 'parcial') {
        const msg =
          result.error ??
          'Importação SIA concluída parcialmente. Revise os logs para detalhes.';
        setDegraded(msg);
      }

      showToast(formatResultToast(result));
      await Promise.all([carregarHistorico(), consultarCompetencia(competencia)]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na importação SIA';
      if (!reimportar && isConflictError(message)) {
        setConfirmOpen(true);
        return;
      }
      if (isMysqlUnavailableError(message)) {
        setDegraded('MySQL/XAMPP indisponível. Exibindo histórico de produção SIA.');
      }
      showToast(message);
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmReimport = async () => {
    setConfirmOpen(false);
    await runSync(true);
  };

  return (
    <>
      <section className="card cadastro-sync-banner" data-testid="sia-sync-banner">
        <div className="cadastro-sync-banner-main">
          <div>
            <h3 className="cadastro-sync-title">Importar produção SIA</h3>
            <p className="cadastro-sync-desc">
              Selecione a competência e importe a produção agregada (separada da sync de
              cadastros).
            </p>
          </div>

          <div className="sia-sync-actions">
            <label className="sia-sync-month-field">
              <span className="mono">Competência</span>
              <input
                type="month"
                value={competencia}
                onChange={(event) => setCompetencia(event.target.value)}
                data-testid="sia-sync-month"
              />
            </label>
            <button
              type="button"
              className="cadastro-btn primary"
              disabled={syncing}
              onClick={() => void runSync(false)}
              data-testid="sia-sync-button"
            >
              {syncing ? 'Importando…' : 'Importar produção SIA'}
            </button>
          </div>
        </div>

        {existeInfo?.exists ? (
          <p className="sia-sync-badge mono" data-testid="sia-sync-badge-importada">
            Já importada em{' '}
            {existeInfo.sincronizado_em ? formatImportDate(existeInfo.sincronizado_em) : 'data não informada'} ·{' '}
            {existeInfo.registros} linhas agregadas
          </p>
        ) : null}

        {degraded ? (
          <p className="analytics-state analytics-state-error cadastro-sync-degraded" role="alert">
            {degraded}
          </p>
        ) : null}

        <div className="cadastro-sync-meta mono" data-testid="sia-sync-history">
          {historyLoading ? (
            'Carregando histórico SIA…'
          ) : recentHistory.length ? (
            <>
              Últimas competências:{' '}
              {recentHistory
                .map((item) => `${item.competencia.slice(0, 7)} (${item.registros})`)
                .join(' · ')}
            </>
          ) : (
            'Nenhuma sincronização SIA registrada ainda.'
          )}
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Competência já importada"
        message={`A competência ${competencia} já foi importada. Deseja reimportar e substituir os dados atuais?`}
        confirmLabel="Reimportar"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmReimport()}
        busy={syncing}
      />

      <ToastBanner message={toast.message} visible={toast.visible} />
    </>
  );
}
