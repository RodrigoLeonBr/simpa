import { ConfirmDialog } from '../../components/cadastros/ConfirmDialog';
import { buildConflitoTodasMessage } from '../../utils/importacaoView';
import type { PreviewCargaEnriquecida } from '../../types/importacao';

interface TodasConflictModalProps {
  open: boolean;
  item: PreviewCargaEnriquecida | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TodasConflictModal({
  open,
  item,
  busy = false,
  onCancel,
  onConfirm,
}: TodasConflictModalProps) {
  if (!item) {
    return null;
  }

  return (
    <ConfirmDialog
      open={open}
      title='Conflito com importação "Todas"'
      message={
        buildConflitoTodasMessage(item) ??
        'Confirme a remoção das importações agregadas "Todas" para continuar.'
      }
      confirmLabel='Confirmar remoção e importar'
      onCancel={onCancel}
      onConfirm={onConfirm}
      busy={busy}
    />
  );
}
