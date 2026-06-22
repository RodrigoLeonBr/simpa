import type { ReactNode } from 'react';
import { ModalPortal } from '../ModalPortal';
import { ToastBanner } from '../../shared/Toast';

interface EstabelecimentoDrawerChromeProps {
  title: string;
  onClose: () => void;
  toastMessage: string;
  toastVisible: boolean;
  children: ReactNode;
}

export function EstabelecimentoDrawerChrome({
  title,
  onClose,
  toastMessage,
  toastVisible,
  children,
}: EstabelecimentoDrawerChromeProps) {
  return (
    <ModalPortal>
      <div className="cadastro-dialog-backdrop" data-testid="estabelecimento-drawer-backdrop">
        <div
          className="cadastro-dialog card cadastro-detail-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="estabelecimento-detail-title"
          data-testid="estabelecimento-detail-drawer"
        >
          <div className="cadastro-dialog-head">
            <h3 id="estabelecimento-detail-title">{title}</h3>
            <button
              type="button"
              className="cadastro-dialog-close"
              onClick={onClose}
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>

          <div className="cadastro-detail-body">{children}</div>

          <ToastBanner message={toastMessage} visible={toastVisible} />
        </div>
      </div>
    </ModalPortal>
  );
}
