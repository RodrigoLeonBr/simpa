import { ModalPortal } from './ModalPortal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  hideCancel = false,
  onCancel,
  onConfirm,
  busy = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <ModalPortal>
      <div className="cadastro-dialog-backdrop" data-testid="confirm-dialog-backdrop">
      <div
        className="cadastro-dialog card cadastro-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cadastro-confirm-title"
        data-testid="confirm-dialog"
      >
        <div className="cadastro-dialog-head">
          <h3 id="cadastro-confirm-title">{title}</h3>
        </div>
        <p className="cadastro-confirm-message">{message}</p>
        <div className="cadastro-form-actions">
          {!hideCancel ? (
            <button type="button" className="cadastro-btn ghost" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="cadastro-btn danger"
            onClick={onConfirm}
            disabled={busy}
            data-testid="confirm-dialog-action"
          >
            {busy ? 'Processando…' : confirmLabel}
          </button>
        </div>
      </div>
      </div>
    </ModalPortal>
  );
}
