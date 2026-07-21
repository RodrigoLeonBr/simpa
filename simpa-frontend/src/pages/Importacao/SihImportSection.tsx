import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SihConflictError,
  getSihSincronizacaoExiste,
  getSihSincronizacoes,
  getSihSyncProgress,
  isSihConflictError,
  sincronizarSih,
} from '../../api/sih';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import type {
  SihImportResult,
  SihProgress,
  SihSincronizacao,
  SihSincronizacaoPorCnes,
  SihSyncExistsResponse,
  SihSyncProgressEvent,
} from '../../types/sih';
import { formatImportDate } from '../../utils/importacaoView';

type SihHistoryRow = {
  key: string;
  competencia: string;
  status: string;
  cnes: string;
  unidade: string;
  qtd_aih: number;
  qtd_internacoes: number;
  qtd_procedimentos: number;
  sincronizado_em: string | null;
};

function flattenHistoryRows(history: SihSincronizacao[]): SihHistoryRow[] {
  const rows: SihHistoryRow[] = [];
  for (const item of history) {
    const porCnes: SihSincronizacaoPorCnes[] = item.por_cnes?.length
      ? item.por_cnes
      : [{
          cnes: '—',
          unidade: '—',
          qtd_aih: item.qtd_aih ?? 0,
          qtd_internacoes: item.qtd_internacoes,
          qtd_procedimentos: item.qtd_procedimentos,
        }];
    for (const c of porCnes) {
      rows.push({
        key: `${item.id}-${c.cnes}`,
        competencia: item.competencia.slice(0, 7),
        status: item.status,
        cnes: c.cnes,
        unidade: c.unidade,
        qtd_aih: c.qtd_aih,
        qtd_internacoes: c.qtd_internacoes,
        qtd_procedimentos: c.qtd_procedimentos,
        sincronizado_em: item.sincronizado_em ?? null,
      });
    }
  }
  return rows;
}

function defaultCompetencia(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const m = String(prev.getMonth() + 1).padStart(2, '0');
  return `${prev.getFullYear()}-${m}`;
}

function buildSihExecutionId(competencia: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : `${Date.now()}${Math.floor(Math.random() * 9999)}`;
  return `sih_${competencia.replace('-', '')}_${rnd}`;
}

function formatSihToast(result: SihImportResult): string {
  const parts = [
    `${result.qtd_aih ?? 0} AIH`,
    `${result.qtd_internacoes ?? 0} internações`,
    `${result.qtd_procedimentos ?? 0} procedimentos`,
  ];
  if ((result.orphan_cnes ?? 0) > 0) parts.push(`${result.orphan_cnes} CNES sem match`);
  return `Importação SIHD concluída — ${parts.join(', ')}.`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ok': return 'OK';
    case 'parcial': return 'Parcial';
    case 'erro': return 'Erro';
    case 'pendente': return 'Pendente';
    default: return status;
  }
}

function stageLabel(stage?: string): string {
  switch (stage) {
    case 'iniciando': return 'Iniciando';
    case 'extracao_mysql_internacoes': return 'Extração MySQL (internações)';
    case 'extracao_mysql_procedimentos': return 'Extração MySQL (procedimentos)';
    case 'gravar_postgres': return 'Gravação PostgreSQL';
    case 'concluido': return 'Concluído';
    case 'erro': return 'Erro';
    default: return stage || 'Processando';
  }
}

function stagePercent(stage?: string, events?: SihProgress['events']): number {
  if (stage === 'gravar_postgres' && events?.length) {
    const last = [...events]
      .reverse()
      .find((e) => e.chunk_index != null && e.chunks_total != null && e.chunks_total > 0);
    if (last) {
      return Math.min(95, 50 + Math.round(((last.chunk_index! + 1) / last.chunks_total!) * 45));
    }
    return 75;
  }
  switch (stage) {
    case 'iniciando': return 5;
    case 'extracao_mysql_internacoes': return 25;
    case 'extracao_mysql_procedimentos': return 50;
    case 'gravar_postgres': return 75;
    case 'concluido': return 100;
    default: return 5;
  }
}

function formatEventLine(ev: SihSyncProgressEvent): string {
  const parts: string[] = [];
  if (ev.message) parts.push(ev.message);
  else parts.push(ev.event);
  if (ev.block_rows) parts.push(`${ev.block_rows} linhas`);
  if (ev.inserted_rows_total != null) parts.push(`${ev.inserted_rows_total} gravadas`);
  if (ev.duration_ms) parts.push(`${ev.duration_ms} ms`);
  return parts.join(' · ');
}

function SpinnerIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="sih-spinner"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

export function SihImportSection() {
  const [competencia, setCompetencia] = useState(defaultCompetencia);
  const [syncing, setSyncing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<SihSincronizacao[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<SihConflictError | null>(null);
  const [errorDialogMessage, setErrorDialogMessage] = useState<string | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SihProgress | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [existeInfo, setExisteInfo] = useState<SihSyncExistsResponse | null>(null);
  const { toast, showToast } = useToast();

  const carregarHistorico = useCallback(async () => {
    try {
      const items = await getSihSincronizacoes();
      setHistory(items);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const consultarCompetencia = useCallback(async (comp: string) => {
    try {
      const result = await getSihSincronizacaoExiste(comp);
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

  // Progress polling during sync
  useEffect(() => {
    if (!syncing || !executionId) return;
    let active = true;
    const tick = async () => {
      try {
        const payload = await getSihSyncProgress(executionId);
        if (!active) return;
        setProgress(payload);
        setProgressError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Falha ao consultar progresso';
        if (!message.includes('404')) setProgressError(message);
      }
    };
    const startDelay = window.setTimeout(() => void tick(), 1200);
    const timer = window.setInterval(() => void tick(), 1500);
    return () => {
      active = false;
      window.clearTimeout(startDelay);
      window.clearInterval(timer);
    };
  }, [syncing, executionId]);

  const recentEvents = useMemo(() => progress?.events?.slice(-8).reverse() ?? [], [progress]);
  const pct = useMemo(() => stagePercent(progress?.stage, progress?.events), [progress]);
  const historyRows = useMemo(() => flattenHistoryRows(history), [history]);

  const runSync = async (reimportar: boolean) => {
    const execId = buildSihExecutionId(competencia);
    setExecutionId(execId);
    setSyncing(true);
    setProgress(null);
    setProgressError(null);
    setErrorDialogMessage(null);

    try {
      const result = await sincronizarSih(competencia, {
        reimportar: reimportar || undefined,
        executionId: execId,
      });

      try {
        const finalProgress = await getSihSyncProgress(execId);
        setProgress(finalProgress);
      } catch {
        // progresso final não crítico
      }

      if (result.error === 'SIH_MYSQL_UNAVAILABLE') {
        setErrorDialogMessage(
          'Banco SIHD (XAMPP) indisponível. Verifique a conexão e tente novamente.',
        );
        return;
      }

      showToast(formatSihToast(result));
      await Promise.all([carregarHistorico(), consultarCompetencia(competencia)]);
    } catch (err) {
      if (!reimportar && isSihConflictError(err)) {
        setConflictInfo(err as SihConflictError);
        setConfirmOpen(true);
        return;
      }
      if (err instanceof Error && err.message === 'HTTP 503') {
        setErrorDialogMessage(
          'Banco SIHD (XAMPP) indisponível. Verifique a conexão e tente novamente.',
        );
        return;
      }
      setErrorDialogMessage(
        err instanceof Error ? err.message : 'Erro ao importar dados SIHD.',
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmReimport = async () => {
    setConfirmOpen(false);
    setConflictInfo(null);
    await runSync(true);
  };

  const activeStageLabel = progress
    ? stageLabel(progress.stage)
    : syncing
      ? 'Iniciando…'
      : '';

  return (
    <>
      <section className="card cadastro-sync-banner" data-testid="sih-import-section">
        <div className="cadastro-sync-banner-main">
          <div>
            <h3 className="cadastro-sync-title">Importar internações SIHD (AIH)</h3>
            <p className="cadastro-sync-desc">
              Selecione a competência e importe internações hospitalares do SIHD Decisor
              (tabelas s_aih + s_aih_pa). Requisito: sincronização de cadastros SIA atualizada.
            </p>
          </div>

          <div className="sia-sync-actions">
            <label className="sia-sync-month-field">
              <span className="mono">Competência</span>
              <input
                type="month"
                value={competencia}
                onChange={(e) => setCompetencia(e.target.value)}
                data-testid="sih-import-competencia"
              />
            </label>
            <button
              type="button"
              className="cadastro-btn primary sih-import-btn-inner"
              disabled={syncing}
              onClick={() => void runSync(false)}
              data-testid="sih-import-btn"
            >
              {syncing ? (
                <>
                  <SpinnerIcon />
                  <span>{activeStageLabel}{pct > 5 && pct < 100 ? ` · ${pct}%` : ''}</span>
                </>
              ) : (
                'Importar internações AIH'
              )}
            </button>
          </div>
        </div>

        {existeInfo?.exists ? (
          <p className="sia-sync-badge mono" data-testid="sih-import-badge-importada">
            Já importada em{' '}
            {existeInfo.sincronizado_em
              ? formatImportDate(existeInfo.sincronizado_em)
              : 'data não informada'}{' '}
            · {existeInfo.qtd_aih ?? 0} AIH · {existeInfo.qtd_internacoes} internações ·{' '}
            {existeInfo.qtd_procedimentos} procedimentos
          </p>
        ) : null}

        {(syncing || progress) ? (
          <div className="cadastro-sync-meta" data-testid="sih-import-progress-panel">
            <div className="progress-bar-wrap" style={{ marginBottom: '0.5rem' }}>
              <div className="progress-bar-track" style={{ height: '6px' }}>
                <div
                  className="progress-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100 ? 'var(--green, #22c55e)' : 'var(--accent, #2563eb)',
                    transition: 'width 0.4s ease',
                  }}
                  data-testid="sih-progress-bar"
                />
              </div>
            </div>
            <p className="mono">
              <strong>Etapa:</strong>{' '}
              {stageLabel(progress?.stage ?? (syncing ? 'iniciando' : undefined))} ·{' '}
              {progress?.status === 'running' || (syncing && !progress)
                ? 'Em execução'
                : 'Finalizado'}
              {pct > 0 ? ` · ${pct}%` : ''}
            </p>
            {progress?.summary ? (
              <p className="mono" data-testid="sih-import-progress-summary">
                {progress.summary.qtd_aih != null ? `${progress.summary.qtd_aih} AIH · ` : ''}
                {progress.summary.qtd_internacoes} internações ·{' '}
                {progress.summary.qtd_procedimentos} procedimentos
                {progress.summary.orphan_cnes > 0
                  ? ` · ${progress.summary.orphan_cnes} CNES sem match`
                  : ''}
                {progress.summary.erros > 0 ? ` · ${progress.summary.erros} erros` : ''}
              </p>
            ) : null}
            {progressError ? (
              <p className="mono analytics-state analytics-state-error">{progressError}</p>
            ) : null}
            <ul className="mono" data-testid="sih-import-progress-events">
              {recentEvents.length ? (
                recentEvents.map((ev) => (
                  <li key={`${ev.at}-${ev.event}-${ev.chunk_index ?? 0}`}>
                    {new Date(ev.at).toLocaleTimeString('pt-BR')} · {stageLabel(ev.stage)} ·{' '}
                    {formatEventLine(ev)}
                  </li>
                ))
              ) : (
                <li>Aguardando eventos de progresso…</li>
              )}
            </ul>
          </div>
        ) : null}

        <div className="cadastro-sync-meta" data-testid="sih-history-table">
          {historyLoading ? (
            <span>Carregando histórico SIHD…</span>
          ) : historyRows.length === 0 ? (
            <span>Nenhuma importação SIHD registrada.</span>
          ) : (
            <table className="cadastro-table">
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>CNES</th>
                  <th>Unidade</th>
                  <th>Status</th>
                  <th>AIH</th>
                  <th>Internações</th>
                  <th>Procedimentos</th>
                  <th>Importado em</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.key}>
                    <td className="mono">{row.competencia}</td>
                    <td className="mono">{row.cnes}</td>
                    <td>{row.unidade}</td>
                    <td>{statusLabel(row.status)}</td>
                    <td>{row.qtd_aih}</td>
                    <td>{row.qtd_internacoes}</td>
                    <td>{row.qtd_procedimentos}</td>
                    <td className="mono">
                      {row.sincronizado_em ? formatImportDate(row.sincronizado_em) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <div data-testid="sih-confirm-dialog">
        <ConfirmDialog
          open={confirmOpen}
          title="Competência já importada"
          message={
            conflictInfo
              ? `A competência ${conflictInfo.competencia} já foi importada (${conflictInfo.qtd_aih} AIH · ${conflictInfo.qtd_internacoes} internações). Substituir os dados atuais?`
              : `A competência ${competencia} já foi importada. Substituir os dados atuais?`
          }
          confirmLabel="Reimportar"
          onCancel={() => {
            setConfirmOpen(false);
            setConflictInfo(null);
          }}
          onConfirm={() => void handleConfirmReimport()}
          busy={syncing}
        />
      </div>

      <ConfirmDialog
        open={Boolean(errorDialogMessage)}
        title="Erro na importação SIHD"
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
