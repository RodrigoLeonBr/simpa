import { useCallback, useEffect, useState } from 'react';
import { fetchCargas, importVacina, previewVacina } from '../../api/vacina';
import type { VacinaCarga, VacinaImportPreview } from '../../types/vacina';
import { formatImportDate } from '../../utils/importacaoView';

function competenciaMes(value: string): string {
  return String(value).slice(0, 7);
}

export function VacinaImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<VacinaImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cargas, setCargas] = useState<VacinaCarga[]>([]);

  const carregarCargas = useCallback(() => {
    fetchCargas()
      .then(setCargas)
      .catch(() => setCargas([]));
  }, []);

  useEffect(() => {
    carregarCargas();
  }, [carregarCargas]);

  const handlePreview = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    setPreview(null);
    try {
      const result = await previewVacina(file);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao pré-visualizar arquivo.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importVacina(file, preview.competencia.slice(0, 7));
      setSuccess(
        `Importação concluída — competência ${result.competencia.slice(0, 7)} · ${result.doses_total} doses · ${result.linhas} linhas.`,
      );
      setFile(null);
      setPreview(null);
      carregarCargas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar arquivo.');
    } finally {
      setBusy(false);
    }
  };

  const competenciaExistente = preview
    ? cargas.some((c) => competenciaMes(c.competencia) === competenciaMes(preview.competencia))
    : false;

  return (
    <section className="card cadastro-sync-banner" data-testid="vacina-import-section">
      <div className="cadastro-sync-banner-main">
        <div>
          <h3 className="cadastro-sync-title">Vacinas (NIES)</h3>
          <p className="cadastro-sync-desc">
            Importe a planilha de cobertura vacinal exportada do NIES (.xlsx). A competência é
            detectada automaticamente a partir do arquivo. Reimportar uma competência já existente
            substitui a carga anterior.
          </p>
        </div>

        <div className="sia-sync-actions">
          <label className="sia-sync-month-field">
            <span className="mono">Arquivo .xlsx</span>
            <input
              type="file"
              accept=".xlsx"
              data-testid="vacina-import-file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setError(null);
                setSuccess(null);
              }}
            />
          </label>
          <button
            type="button"
            className="cadastro-btn primary"
            disabled={!file || busy}
            onClick={() => void handlePreview()}
            data-testid="vacina-preview-btn"
          >
            {busy && !preview ? 'Processando…' : 'Pré-visualizar'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mono analytics-state analytics-state-error" data-testid="vacina-import-error">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mono sia-sync-badge" data-testid="vacina-import-success">
          {success}
        </p>
      ) : null}

      {preview ? (
        <div className="cadastro-sync-meta" data-testid="vacina-import-preview">
          <p className="mono">
            <strong>Competência:</strong> {preview.competencia.slice(0, 7)} &nbsp;·&nbsp;
            <strong>Linhas:</strong> {preview.linhas} &nbsp;·&nbsp;
            <strong>Doses:</strong> {preview.doses_total}
          </p>
          {competenciaExistente ? (
            <p
              className="mono"
              style={{ color: 'var(--amber, #d97706)' }}
              data-testid="vacina-import-substituir"
            >
              ⚠ Já existe carga para {competenciaMes(preview.competencia)} — importar vai substituir a
              anterior.
            </p>
          ) : null}
          {preview.faixas_nao_mapeadas.length > 0 ? (
            <p
              className="mono"
              style={{ color: 'var(--amber, #d97706)' }}
              data-testid="vacina-import-warning"
            >
              ⚠ Faixas não mapeadas: {preview.faixas_nao_mapeadas.join(', ')}
            </p>
          ) : null}
          <button
            type="button"
            className="cadastro-btn primary"
            disabled={busy}
            onClick={() => void handleImport()}
            data-testid="vacina-confirm-btn"
          >
            {busy ? 'Importando…' : competenciaExistente ? 'Confirmar substituição' : 'Confirmar importação'}
          </button>
        </div>
      ) : null}

      <div className="import-history-wrap" data-testid="vacina-cargas-historico">
        <div className="import-history-head">
          <h4>Histórico de importações</h4>
          <span className="mono import-history-count">{cargas.length}</span>
        </div>
        {cargas.length === 0 ? (
          <p className="analytics-empty" data-testid="vacina-cargas-vazio">
            Nenhuma importação de vacina ainda.
          </p>
        ) : (
          <table className="import-history-table">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Arquivo</th>
                <th className="align-right">Doses</th>
                <th className="align-right">Linhas</th>
                <th>Importado em</th>
              </tr>
            </thead>
            <tbody>
              {cargas.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{competenciaMes(c.competencia)}</td>
                  <td>{c.arquivo_nome}</td>
                  <td className="mono align-right">{c.doses_total}</td>
                  <td className="mono align-right">{c.linhas}</td>
                  <td className="mono import-history-date">{formatImportDate(c.importado_em)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
