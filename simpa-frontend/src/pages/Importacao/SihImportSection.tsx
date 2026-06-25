import { useCallback, useEffect, useState } from 'react';
import {
  SihConflictError,
  getSihSincronizacoes,
  getSihSyncProgress,
  isSihConflictError,
  sincronizarSih,
} from '../../api/sih';
import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import type { SihImportResult, SihSincronizacao } from '../../types/sih';
import { formatImportDate } from '../../utils/importacaoView';

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
  const parts = [`${result.qtd_internacoes ?? 0} internações`, `${result.qtd_procedimentos ?? 0} procedimentos`];
  if ((result.orphan_cnes ?? 0) > 0) {
    parts.push(`${result.orphan_cnes} CNES sem match`);
  }
  return `Importação SIHD concluída — ${parts.join(', ')}.`;
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'parcial':
      return 'Parcial';
    case 'erro':
      return 'Erro';
    case 'pendente':
      return 'Pendente';
    default:
      return status;
  }
}

export function SihImportSection() {
  const [competencia, setCompetencia] = useState(defaultCompetencia);
  const [syncing, setSyncing] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<SihSincronizacao[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<SihConflictError | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  const runSync = async (reimportar: boolean) => {
    const execId = buildSihExecutionId(competencia);
    setSyncing(true);
    setErrorMessage(null);
    try {
      const result = await sincronizarSih(competencia, reimportar || undefined);

      if (result.error === 'SIH_MYSQL_UNAVAILABLE') {
        setErrorMessage(
          'Banco SIHD (XAMPP) indisponível. Verifique a conexão e tente novamente.',
        );
        return;
      }

      // Poll progress briefly
      try {
        await getSihSyncProgress(execId);
      } catch {
        // progresso não crítico
      }

      showToast(formatSihToast(result));
      await carregarHistorico();
    } catch (err) {
      if (!reimportar && isSihConflictError(err)) {
        setConflictInfo(err as SihConflictError);
        setConfirmOpen(true);
        return;
      }
      if (err instanceof Error && err.message === 'HTTP 503') {
        setErrorMessage(
          'Banco SIHD (XAMPP) indisponível. Verifique a conexão e tente novamente.',
        );
        return;
      }
      setErrorMessage(
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
              className="cadastro-btn primary"
              disabled={syncing}
              onClick={() => void runSync(false)}
              data-testid="sih-import-btn"
            >
              {syncing ? 'Importando…' : 'Importar internações AIH'}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <p
            className="analytics-state analytics-state-error cadastro-sync-degraded"
            role="alert"
            data-testid="sih-import-error"
          >
            {errorMessage}
          </p>
        ) : null}

        <div className="cadastro-sync-meta" data-testid="sih-history-table">
          {historyLoading ? (
            <span>Carregando histórico SIHD…</span>
          ) : history.length === 0 ? (
            <span>Nenhuma importação SIHD registrada.</span>
          ) : (
            <table className="cadastro-table">
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Status</th>
                  <th>Internações</th>
                  <th>Procedimentos</th>
                  <th>Importado em</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.competencia.slice(0, 7)}</td>
                    <td>{statusLabel(item.status)}</td>
                    <td>{item.qtd_internacoes}</td>
                    <td>{item.qtd_procedimentos}</td>
                    <td className="mono">
                      {item.sincronizado_em ? formatImportDate(item.sincronizado_em) : '—'}
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
              ? `A competência ${conflictInfo.competencia} já foi importada (${conflictInfo.qtd_internacoes} internações). Substituir os dados atuais?`
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

      <ToastBanner message={toast.message} visible={toast.visible} />
    </>
  );
}
