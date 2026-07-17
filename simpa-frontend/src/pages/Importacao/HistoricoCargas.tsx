import { useEffect, useRef, useState } from 'react';
import type { CargaEsus } from '../../types/contrato';
import { excluirCarga, reprocessarCarga, substituirCarga } from '../../api/importacao';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import {
  buildCargaStatus,
  formatCompetencia,
  formatImportDate,
  formatTipoRelatorio,
  isCsvFile,
  notifyCargasUpdated,
} from '../../utils/importacaoView';

interface HistoricoCargasProps {
  cargas: CargaEsus[];
  onAtualizar: () => void;
}

const INITIAL_VISIBLE = 15;
const LOAD_MORE_STEP = 20;

function CargaStatusBadge({
  registrosIdentificados,
  registrosNaoIdentificados,
}: {
  registrosIdentificados: number | null;
  registrosNaoIdentificados: number | null;
}) {
  const status = buildCargaStatus(registrosIdentificados, registrosNaoIdentificados);

  return (
    <span
      className={`status-badge status-badge-${status.tone}`}
      style={{ color: status.color, background: status.badgeBg }}
    >
      {status.label}
    </span>
  );
}

export function HistoricoCargas({ cargas, onAtualizar }: HistoricoCargasProps) {
  const [confirmExcluir, setConfirmExcluir] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<number | null>(null);
  const { toast, showToast } = useToast();

  useEffect(() => {
    setVisibleCount((prev) => Math.max(INITIAL_VISIBLE, Math.min(prev, cargas.length)));
  }, [cargas]);

  const visibleCargas = cargas.slice(0, visibleCount);
  const hasMore = visibleCount < cargas.length;
  const remaining = cargas.length - visibleCount;
  const nextBatch = Math.min(LOAD_MORE_STEP, remaining);

  const runAction = async (id: number, action: () => Promise<unknown>, successMessage: string) => {
    setBusyId(id);
    try {
      await action();
      notifyCargasUpdated();
      showToast(successMessage);
      onAtualizar();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha na operação');
    } finally {
      setBusyId(null);
    }
  };

  const handleReprocessar = (id: number) => {
    void runAction(id, () => reprocessarCarga(id), 'Carga reprocessada');
  };

  const handleSubstituirClick = (id: number) => {
    replaceTargetRef.current = id;
    replaceInputRef.current?.click();
  };

  const handleSubstituirFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const id = replaceTargetRef.current;
    event.target.value = '';

    if (!file || id === null) return;
    if (!isCsvFile(file)) {
      showToast('Somente arquivos .csv são aceitos.');
      return;
    }

    void runAction(id, () => substituirCarga(id, file), 'Arquivo substituído');
  };

  const handleExcluir = async (id: number) => {
    if (confirmExcluir !== id) {
      setConfirmExcluir(id);
      return;
    }

    await runAction(id, () => excluirCarga(id), 'Carga excluída');
    setConfirmExcluir(null);
  };

  return (
    <section className="card import-history-card" data-testid="historico-cargas">
      <div className="import-history-head">
        <h3>Histórico de cargas</h3>
        <span className="mono import-history-count">{cargas.length}</span>
      </div>

      {cargas.length === 0 ? (
        <p className="analytics-empty">Nenhuma carga importada ainda.</p>
      ) : (
        <div className="import-history-wrap">
          <table className="import-history-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Competência</th>
                <th>Unidade / Equipe</th>
                <th className="align-right">Registros</th>
                <th>Status</th>
                <th>Importado em</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {visibleCargas.map((carga) => (
                <tr key={carga.id}>
                  <td className="mono import-history-type">{formatTipoRelatorio(carga.tipo_relatorio)}</td>
                  <td className="mono">{formatCompetencia(carga.competencia)}</td>
                  <td>
                    <div>{carga.unidade}</div>
                    <div className="import-history-equipe">{carga.equipe_nome}</div>
                  </td>
                  <td className="mono align-right">
                    <span className="import-history-ok">{carga.registros_identificados ?? '—'}</span>
                    {(carga.registros_nao_identificados ?? 0) > 0 ? (
                      <span className="import-history-reject"> / {carga.registros_nao_identificados} rej.</span>
                    ) : null}
                  </td>
                  <td>
                    <CargaStatusBadge
                      registrosIdentificados={carga.registros_identificados}
                      registrosNaoIdentificados={carga.registros_nao_identificados}
                    />
                  </td>
                  <td className="mono import-history-date">{formatImportDate(carga.importado_em)}</td>
                  <td>
                    <div className="import-history-actions">
                      <button
                        type="button"
                        className="import-action-btn"
                        title="Reprocessar"
                        disabled={busyId === carga.id}
                        onClick={() => handleReprocessar(carga.id)}
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        className="import-action-btn"
                        title="Substituir arquivo"
                        disabled={busyId === carga.id}
                        onClick={() => handleSubstituirClick(carga.id)}
                      >
                        ⇪
                      </button>
                      <button
                        type="button"
                        className={`import-action-btn danger${confirmExcluir === carga.id ? ' confirm' : ''}`}
                        title={confirmExcluir === carga.id ? 'Clique para confirmar' : 'Excluir'}
                        disabled={busyId === carga.id}
                        onClick={() => void handleExcluir(carga.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cargas.length > INITIAL_VISIBLE ? (
        <div className="import-history-footer">
          <span className="import-history-showing">
            Exibindo {visibleCargas.length} de {cargas.length}
          </span>
          {hasMore ? (
            <button
              type="button"
              className="import-history-load-more"
              data-testid="historico-cargas-load-more"
              onClick={() => setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, cargas.length))}
            >
              Ver mais importações ({nextBatch})
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={replaceInputRef}
        type="file"
        accept=".csv,text/csv"
        className="import-upload-input"
        onChange={handleSubstituirFile}
        data-testid="replace-input"
      />

      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
