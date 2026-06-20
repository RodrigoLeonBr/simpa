import { useCallback, useEffect, useRef, useState } from 'react';
import { previewUpload, uploadCargas } from '../../api/importacao';
import { ToastBanner, useToast } from '../../components/shared/Toast';
import { useAuth } from '../../contexts/AuthContext';
import type { PreviewCargaEnriquecida } from '../../types/importacao';
import {
  buildResolucoesUpload,
  canEditImportMappings,
  canEnableProcess,
  defaultDraftFromPreview,
  filterCsvFiles,
  needsTodasConfirmation,
  notifyCargasUpdated,
  type ResolucaoDraft,
} from '../../utils/importacaoView';
import { PreviewMappingRow } from './PreviewMappingRow';
import { TodasConflictModal } from './TodasConflictModal';

interface UploadZoneProps {
  onUploadConcluido?: () => void;
}

function buildInitialDrafts(rows: PreviewCargaEnriquecida[]): Record<string, ResolucaoDraft> {
  return Object.fromEntries(rows.map((row) => [row.nome, defaultDraftFromPreview(row)]));
}

export function UploadZone({ onUploadConcluido }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const isPlanningStaff = canEditImportMappings(user?.perfil);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<PreviewCargaEnriquecida[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ResolucaoDraft>>({});
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [todasModalItem, setTodasModalItem] = useState<PreviewCargaEnriquecida | null>(null);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const { toast, showToast } = useToast();

  const processEnabled = canEnableProcess(preview, drafts, isPlanningStaff);

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
        setDrafts({});
        return;
      }

      setFiles(csvFiles);
      setLoading(true);

      try {
        const resultado = await previewUpload(csvFiles);
        setPreview(resultado);
        setDrafts(buildInitialDrafts(resultado));
      } catch (err) {
        setPreview([]);
        setDrafts({});
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
    setDrafts({});
    setValidationError(null);
    setTodasModalItem(null);
  };

  const runUpload = useCallback(async () => {
    const resolucoes = buildResolucoesUpload(preview, drafts);
    await uploadCargas(files, resolucoes);
    setFiles([]);
    setPreview([]);
    setDrafts({});
    setValidationError(null);
    setTodasModalItem(null);
    notifyCargasUpdated();
    showToast('Importação concluída');
    onUploadConcluido?.();
  }, [drafts, files, onUploadConcluido, preview, showToast]);

  const handleProcessar = async () => {
    if (!files.length || !processEnabled) return;

    const conflict = needsTodasConfirmation(preview, drafts);
    if (conflict) {
      setTodasModalItem(conflict);
      return;
    }

    setLoading(true);
    try {
      await runUpload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao processar upload');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTodas = async () => {
    if (!todasModalItem) return;

    const itemNome = todasModalItem.nome;
    const nextDrafts = {
      ...draftsRef.current,
      [itemNome]: {
        ...(draftsRef.current[itemNome] ?? defaultDraftFromPreview(todasModalItem)),
        confirmar_remocao_todas: true,
      },
    };
    const resolucoes = buildResolucoesUpload(preview, nextDrafts);
    setDrafts(nextDrafts);

    setLoading(true);
    try {
      await uploadCargas(files, resolucoes);
      handleCancel();
      notifyCargasUpdated();
      showToast('Importação concluída');
      onUploadConcluido?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao processar upload');
    } finally {
      setLoading(false);
      setTodasModalItem(null);
    }
  };

  useEffect(() => {
    if (todasModalItem && !needsTodasConfirmation(preview, drafts)) {
      setTodasModalItem(null);
    }
  }, [drafts, preview, todasModalItem]);

  return (
    <>
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
            <p className="import-upload-subtitle">
              ou clique para selecionar — múltiplos arquivos permitidos
            </p>
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
              <PreviewMappingRow
                key={item.nome}
                item={item}
                draft={drafts[item.nome] ?? defaultDraftFromPreview(item)}
                canEdit={isPlanningStaff}
                onDraftChange={(next) =>
                  setDrafts((current) => ({ ...current, [item.nome]: next }))
                }
              />
            ))}

            {!isPlanningStaff ? (
              <p className="import-upload-hint" data-testid="upload-planning-hint">
                Somente usuários de planejamento podem processar importações com mapeamento.
              </p>
            ) : null}

            <div className="import-preview-actions">
              <button type="button" className="btn-ghost" onClick={handleCancel} disabled={loading}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleProcessar}
                disabled={loading || !processEnabled}
                data-testid="upload-process-btn"
              >
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

      <TodasConflictModal
        open={Boolean(todasModalItem)}
        item={todasModalItem}
        busy={loading}
        onCancel={() => setTodasModalItem(null)}
        onConfirm={() => void handleConfirmTodas()}
      />
    </>
  );
}
