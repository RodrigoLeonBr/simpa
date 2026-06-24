import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchSiaSyncProgress,
  fetchSiaSincronizacaoExiste,
  fetchSiaSincronizacoes,
  sincronizarSiaProducao,
} from '../../api/sia';
import type {
  SiaSyncExistsResponse,
  SiaSyncProgress,
  SiaSyncRecord,
  SiaSyncResult,
} from '../../types/sia';
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

function buildExecutionId(competencia: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now()}${Math.floor(Math.random() * 9999)}`;
  return `sia_${competencia.replace('-', '')}_${randomPart}`;
}

function stageLabel(stage?: string): string {
  switch (stage) {
    case 'iniciando':
      return 'Iniciando';
    case 'extracao_mysql':
      return 'Extração MySQL';
    case 'transformacao':
      return 'Transformação';
    case 'gravar_postgres':
      return 'Gravação PostgreSQL';
    case 'concluido':
      return 'Concluído';
    case 'erro':
      return 'Erro';
    default:
      return stage || 'Processando';
  }
}

function formatEventLine(progressEvent: NonNullable<SiaSyncProgress['events']>[number]): string {
  const parts: string[] = [];
  if (progressEvent.message) {
    parts.push(progressEvent.message);
  } else {
    parts.push(progressEvent.event);
  }
  if (progressEvent.block_rows) {
    parts.push(`${progressEvent.block_rows} linhas`);
  }
  if (progressEvent.duration_ms) {
    parts.push(`${progressEvent.duration_ms} ms`);
  }
  if (progressEvent.inserted_rows_total && progressEvent.total_rows) {
    parts.push(`${progressEvent.inserted_rows_total}/${progressEvent.total_rows}`);
  }
  return parts.join(' · ');
}

export function SiaProducaoSyncBanner() {
  const [competencia, setCompetencia] = useState(defaultCompetencia);
  const [syncing, setSyncing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<SiaSyncRecord[]>([]);
  const [degraded, setDegraded] = useState<string | null>(null);
  const [existeInfo, setExisteInfo] = useState<SiaSyncExistsResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SiaSyncProgress | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
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
  const progressEvents = useMemo(() => progress?.events?.slice(-8).reverse() ?? [], [progress]);

  useEffect(() => {
    if (!syncing || !executionId) {
      return;
    }
    let active = true;
    const tick = async () => {
      try {
        const payload = await fetchSiaSyncProgress(executionId);
        if (!active) return;
        setProgress(payload);
        setProgressError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Falha ao consultar progresso';
        if (!message.includes('404')) {
          setProgressError(message);
        }
      }
    };
    const startDelay = window.setTimeout(() => {
      void tick();
    }, 1200);
    const timer = window.setInterval(() => {
      void tick();
    }, 1500);
    return () => {
      active = false;
      window.clearTimeout(startDelay);
      window.clearInterval(timer);
    };
  }, [syncing, executionId]);

  const runSync = async (reimportar: boolean) => {
    const currentExecutionId = buildExecutionId(competencia);
    setSyncing(true);
    setDegraded(null);
    setExecutionId(currentExecutionId);
    setProgress(null);
    setProgressError(null);
    try {
      const result = await sincronizarSiaProducao(competencia, {
        reimportar,
        executionId: currentExecutionId,
      });
      try {
        const finalProgress = await fetchSiaSyncProgress(currentExecutionId);
        setProgress(finalProgress);
      } catch {
        // ignora ausência de progresso final
      }

      if (result.status === 'erro') {
        const msg = result.error ?? 'Falha na importação de produção SIA.';
        if (isMysqlUnavailableError(msg)) {
          setDegraded('MySQL/XAMPP indisponível. Exibindo histórico de produção SIA.');
        }
        setErrorDialogMessage(msg);
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
      setErrorDialogMessage(message);
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
            <p className="cadastro-sync-desc mono">
              Grupo de idade SIA é preservado na carga; faixas etárias analíticas são definidas no
              relatório.
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

        {(syncing || progress) && (
          <div className="cadastro-sync-meta" data-testid="sia-sync-progress-panel">
            <p className="mono">
              <strong>Status:</strong>{' '}
              {progress ? stageLabel(progress.stage) : 'Iniciando processamento'} ·{' '}
              {progress?.status === 'running' || syncing ? 'Em execução' : 'Finalizado'}
            </p>
            {progress?.summary ? (
              <p className="mono" data-testid="sia-sync-progress-summary">
                Resultado: {progress.summary.status} · {progress.summary.registros} linhas agregadas ·{' '}
                {progress.summary.linhas_mysql_raw} linhas brutas · {progress.summary.erros} erros
              </p>
            ) : null}
            {progressError ? (
              <p className="mono analytics-state analytics-state-error">{progressError}</p>
            ) : null}
            <ul className="mono" data-testid="sia-sync-progress-events">
              {progressEvents.length ? (
                progressEvents.map((event) => (
                  <li key={`${event.at}-${event.event}-${event.block_index ?? 0}`}>
                    {new Date(event.at).toLocaleTimeString('pt-BR')} · {stageLabel(event.stage)} ·{' '}
                    {formatEventLine(event)}
                  </li>
                ))
              ) : (
                <li>Aguardando eventos de progresso...</li>
              )}
            </ul>
          </div>
        )}
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

      <ConfirmDialog
        open={Boolean(errorDialogMessage)}
        title="Erro na importação SIA"
        message={errorDialogMessage ?? ''}
        confirmLabel="OK"
        hideCancel
        onCancel={() => setErrorDialogMessage(null)}
        onConfirm={() => setErrorDialogMessage(null)}
      />

      <ToastBanner message={toast.message} visible={toast.visible} />
    </>
  );
}
