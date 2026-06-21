import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CADASTRO_ENTITIES } from '../../config/cadastroEntities';
import { FormDialog } from './FormDialog';

describe('FormDialog', () => {
  afterEach(() => cleanup());

  it('keeps submit disabled when required id_emenda is empty', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const config = CADASTRO_ENTITIES.find((entity) => entity.key === 'emendas')!;

    render(
      <FormDialog
        open
        title="Nova Emenda"
        fields={config.fields}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Salvar' });
    expect(submitButton).toBeDisabled();
    await user.type(screen.getByLabelText(/Esfera/i), 'Federal');
    expect(submitButton).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps submit disabled when required esfera is empty', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    const config = CADASTRO_ENTITIES.find((entity) => entity.key === 'emendas')!;

    render(
      <FormDialog
        open
        title="Nova Emenda"
        fields={config.fields}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const submitButton = screen.getByRole('button', { name: 'Salvar' });
    expect(submitButton).toBeDisabled();
    await user.type(screen.getByLabelText(/ID Emenda/i), 'EM001');
    expect(submitButton).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits when required fields are filled', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const user = userEvent.setup();
    const config = CADASTRO_ENTITIES.find((entity) => entity.key === 'emendas')!;

    render(
      <FormDialog
        open
        title="Nova Emenda"
        fields={config.fields}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/ID Emenda/i), 'EM001');
    await user.type(screen.getByLabelText(/Esfera/i), 'Federal');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        id_emenda: 'EM001',
        esfera: 'Federal',
        tipo: '',
        autor: '',
        objeto: '',
        valor_repassado: '',
      });
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows submit error message', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Falha API'));
    const user = userEvent.setup();
    const config = CADASTRO_ENTITIES.find((entity) => entity.key === 'emendas')!;

    render(
      <FormDialog
        open
        title="Nova Emenda"
        fields={config.fields}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/ID Emenda/i), 'EM001');
    await user.type(screen.getByLabelText(/Esfera/i), 'Federal');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Falha API')).toBeInTheDocument();
  });

  it('renders select options for equipe estabelecimento field', () => {
    const config = CADASTRO_ENTITIES.find((entity) => entity.key === 'equipes')!;

    render(
      <FormDialog
        open
        title="Nova Equipe"
        fields={config.fields}
        selectOptions={{
          estabelecimento_id: [{ value: '1', label: 'UBS Centro' }],
        }}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'UBS Centro' })).toBeInTheDocument();
  });
});
