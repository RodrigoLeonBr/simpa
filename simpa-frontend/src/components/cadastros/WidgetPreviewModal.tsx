import { useEffect, useState } from 'react';
import { fetchEstabelecimentosAps } from '../../api/cadastros';
import { previewPainelWidget } from '../../api/painelWidgets';
import { DEFAULT_COMPETENCIAS } from '../../config/navigation';
import type { Estabelecimento } from '../../types/cadastros';
import type { PainelWidgetConfig, ResolvedPainelWidget } from '../../types/painelWidgets';
import { activeEstabelecimentos } from '../../utils/estabelecimentosView';
import { ModalPortal } from './ModalPortal';
import { WidgetPreviewResult } from './WidgetPreviewResult';

interface WidgetPreviewModalProps {
  open: boolean;
  widget: PainelWidgetConfig | null;
  onClose: () => void;
  onError: (message: string) => void;
}

export function WidgetPreviewModal({ open, widget, onClose, onError }: WidgetPreviewModalProps) {
  const [competencia, setCompetencia] = useState(DEFAULT_COMPETENCIAS[0] ?? '2026-05');
  const [estabelecimentoId, setEstabelecimentoId] = useState('');
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([]);
  const [estabelecimentosBusy, setEstabelecimentosBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewResult, setPreviewResult] = useState<ResolvedPainelWidget | null>(null);

  useEffect(() => {
    if (!open) return;
    setCompetencia(DEFAULT_COMPETENCIAS[0] ?? '2026-05');
    setEstabelecimentoId('');
    setPreviewResult(null);
    setPreviewBusy(false);
  }, [open, widget?.id]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadEstabelecimentos() {
      setEstabelecimentosBusy(true);
      try {
        const rows = await fetchEstabelecimentosAps();
        if (!cancelled) {
          setEstabelecimentos(rows);
        }
      } catch (_err) {
        if (!cancelled) {
          setEstabelecimentos([]);
        }
      } finally {
        if (!cancelled) {
          setEstabelecimentosBusy(false);
        }
      }
    }

    void loadEstabelecimentos();
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open || !widget) return null;

  const estabelecimentoOptions = activeEstabelecimentos(estabelecimentos);

  async function handlePreview() {
    if (!widget) return;
    setPreviewBusy(true);
    setPreviewResult(null);
    try {
      const result = await previewPainelWidget({
        widgetId: widget.id,
        scope: {
          competencia,
          estabelecimentoId: estabelecimentoId ? Number(estabelecimentoId) : undefined,
        },
      });
      setPreviewResult(result);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao pré-visualizar widget');
    } finally {
      setPreviewBusy(false);
    }
  }

  return (
    <ModalPortal>
      <div className="cadastro-dialog-backdrop" data-testid="widget-preview-backdrop">
        <div
          className="cadastro-dialog card widget-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="widget-preview-title"
          data-testid="widget-preview-modal"
        >
          <div className="cadastro-dialog-head">
            <h3 id="widget-preview-title">Pré-visualizar widget</h3>
            <button
              type="button"
              className="cadastro-dialog-close"
              onClick={onClose}
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          <div className="cadastro-form widget-preview-form">
            <p className="cadastro-field-hint">
              {widget.titulo} · {widget.metrica?.label ?? 'Sem métrica'}
            </p>

            <label className="cadastro-field">
              <span>Competência</span>
              <select
                className="mono"
                value={competencia}
                onChange={(event) => setCompetencia(event.target.value)}
                data-testid="preview-competencia"
              >
                {DEFAULT_COMPETENCIAS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="cadastro-field">
              <span>Estabelecimento (opcional)</span>
              <select
                value={estabelecimentoId}
                onChange={(event) => setEstabelecimentoId(event.target.value)}
                data-testid="preview-estabelecimento"
                disabled={estabelecimentosBusy}
              >
                <option value="">Municipal (todas as unidades)</option>
                {estabelecimentoOptions.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </label>

            <div className="cadastro-form-actions">
              <button type="button" className="cadastro-btn ghost" onClick={onClose}>
                Fechar
              </button>
              <button
                type="button"
                className="cadastro-btn primary"
                onClick={() => void handlePreview()}
                disabled={previewBusy}
                data-testid="preview-run-button"
              >
                {previewBusy ? 'Executando…' : 'Executar preview'}
              </button>
            </div>

            {previewResult ? (
              <section className="widget-preview-result" data-testid="widget-preview-result">
                <h4>Resultado</h4>
                <WidgetPreviewResult result={previewResult} testIdPrefix="preview" />
              </section>
            ) : null}

            {widget.sql_override?.trim() || widget.sql_preview ? (
              <details className="widget-sql-details" data-testid="widget-sql-details">
                <summary>Query detail</summary>
                <pre className="widget-sql-preview mono" data-testid="widget-sql-preview">
                  {widget.sql_override?.trim() || widget.sql_preview}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
