import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataTable } from './DataTable';

describe('DataTable', () => {
  afterEach(() => cleanup());

  it('calls row action handlers', async () => {
    const onEdit = vi.fn();
    const onInactivate = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();

    render(
      <DataTable
        columns={[
          { key: 'codigo', label: 'Código' },
          { key: 'status', label: 'Status' },
        ]}
        rows={[{ id: 1, codigo: 'UBS001', status: 'ativo' }]}
        onEdit={onEdit}
        onInactivate={onInactivate}
        onDelete={onDelete}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.click(screen.getByRole('button', { name: 'Inativar' }));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    expect(onEdit).toHaveBeenCalledWith({ id: 1, codigo: 'UBS001', status: 'ativo' });
    expect(onInactivate).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
