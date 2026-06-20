import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  afterEach(() => cleanup());

  it('does not confirm until user clicks confirm action', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open
        title="Excluir registro"
        message="Confirme a exclusão."
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls confirm handler only after explicit confirmation', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open
        title="Excluir registro"
        message="Confirme a exclusão."
        onCancel={vi.fn()}
        onConfirm={onConfirm}
        confirmLabel="Excluir"
      />,
    );

    await user.click(screen.getByTestId('confirm-dialog-action'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
