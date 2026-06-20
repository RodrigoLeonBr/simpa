import { useCallback, useRef, useState } from 'react';
import { previewUpload, uploadCargas } from '../../api/importacao';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import {
  filterCsvFiles,
  notifyCargasUpdated,
  type PreviewCargaItem,
} from '../../utils/importacaoView';

interface UploadZoneProps {
  onUploadConcluido?: () => void;
}

export function UploadZone({ onUploadConcluido }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<PreviewCargaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { toast, showToast } = useToast();

  const processarArquivos = useCallback(
    async (incoming: File[]) => {
      const csvFiles = filterCsvFiles(incoming);
      const rejected = incoming.length - csvFiles.length;

      if (rejected > 0) {
        setValidationError('Somente arquivos .csv são aceitos.');
      } else {
        setValidationError(null);
      }

      if (csvFiles.length === 0) {
        setFiles([]);
        setPreview([]);
        return;
      }

      setFiles(csvFiles);
      setLoading(true);

      try {
        const resultado = await previewUpload(csvFiles);
        setPreview(resultado);
      } catch (err) {
        setPreview([]);
        showToast(err instanceof Error ? err.message : 'Falha ao gerar preview');
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length) void processarArquivos(dropped);
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length) void processarArquivos(selected);
    event.target.value = '';
  };

  const handleCancel = () => {
    setFiles([]);
    setPreview([]);
    setValidationError(null);
  };

  const handleProcessar = async () => {
    if (!files.length) return;

    setLoading(true);
    try {
      await uploadCargas(files);
      setFiles([]);
      setPreview([]);
      setValidationError(null);
      notifyCargasUpdated();
      showToast('Importação concluída');
      onUploadConcluido?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao processar upload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className={`import-upload-zone card${dragging ? ' dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      data-testid="upload-zone"
    >
      {preview.length === 0 ? (
        <label className="import-upload-empty">
          <div className="import-upload-icon" aria-hidden="true">
            ↑
          </div>
          <p className="import-upload-title">Arraste os CSVs do e-SUS aqui</p>
          <p className="import-upload-subtitle">ou clique para selecionar — múltiplos arquivos permitidos</p>
          <p className="import-upload-hint mono">Somente arquivos .csv</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            multiple
            onChange={handleFileInput}
            className="import-upload-input"
            data-testid="upload-input"
          />
        </label>
      ) : (
        <div className="import-preview-list">
          {preview.map((item) => (
            <div key={item.nome} className="import-preview-row" data-testid="preview-row">
              <span className="import-preview-check" aria-hidden="true">
                ✓
              </span>
              <span className="import-preview-name">{item.nome}</span>
              {item.error ? (
                <span className="import-preview-error">{item.error}</span>
              ) : (
                <>
                  <span className="import-preview-tag mono">{item.tipo_relatorio}</span>
                  {item.ja_importado ? (
                    <span className="import-preview-warning">já importado</span>
                  ) : null}
                  <span className="import-preview-meta mono">
                    {item.competencia?.slice(0, 7) ?? '—'} · {item.unidade ?? '—'} · {item.equipe_nome ?? '—'}
                  </span>
                </>
              )}
            </div>
          ))}

          <div className="import-preview-actions">
            <button type="button" className="btn-ghost" onClick={handleCancel} disabled={loading}>
              Cancelar
            </button>
            <button type="button" className="btn-primary" onClick={handleProcessar} disabled={loading} data-testid="upload-process-btn">
              {loading ? 'Processando…' : `Processar ${files.length} arquivo(s) →`}
            </button>
          </div>
        </div>
      )}

      {validationError ? (
        <p className="import-upload-error" role="alert" data-testid="upload-validation-error">
          {validationError}
        </p>
      ) : null}

      <ToastBanner message={toast.message} visible={toast.visible} />
    </section>
  );
}
