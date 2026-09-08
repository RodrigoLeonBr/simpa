import { useState } from 'react';
import { importVacina, previewVacina } from '../../api/vacina';
import type { VacinaImportPreview } from '../../types/vacina';

export function VacinaImportSection() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<VacinaImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar arquivo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card cadastro-sync-banner" data-testid="vacina-import-section">
      <div className="cadastro-sync-banner-main">
        <div>
          <h3 className="cadastro-sync-title">Vacinas (NIES)</h3>
          <p className="cadastro-sync-desc">
            Importe a planilha de cobertura vacinal exportada do NIES (.xlsx). A competência é
            detectada automaticamente a partir do arquivo.
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
            {busy ? 'Importando…' : 'Confirmar importação'}
          </button>
        </div>
      ) : null}
    </section>
  );
}
