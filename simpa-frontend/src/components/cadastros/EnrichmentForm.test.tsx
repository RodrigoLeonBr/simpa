import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnrichmentForm } from './EnrichmentForm';

describe('EnrichmentForm', () => {
  afterEach(() => cleanup());

  it('validates numeric leitos fields', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    render(<EnrichmentForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Clínico/i), '-2');
    await user.click(screen.getByRole('button', { name: /Salvar enriquecimento/i }));

    expect(await screen.findByText(/inteiro/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits valid enrichment payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<EnrichmentForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Clínico/i), '12');
    await user.type(screen.getByLabelText(/^Notas$/i), 'Capacidade ampliada');
    await user.click(screen.getByRole('button', { name: /Salvar enriquecimento/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        leitos: { clinico: 12 },
        especialidades: [],
        habilitacoes: [],
        capacidade_notas: '',
        notas: 'Capacidade ampliada',
      });
    });
  });
});
