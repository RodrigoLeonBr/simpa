import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnrichmentForm } from './EnrichmentForm';

describe('EnrichmentForm', () => {
  afterEach(() => cleanup());

  it('submits valid enrichment payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<EnrichmentForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Notas$/i), 'Capacidade ampliada');
    await user.click(screen.getByRole('button', { name: /Salvar enriquecimento/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        especialidades: [],
        habilitacoes: [],
        capacidade_notas: '',
        notas: 'Capacidade ampliada',
      });
    });
  });
});
