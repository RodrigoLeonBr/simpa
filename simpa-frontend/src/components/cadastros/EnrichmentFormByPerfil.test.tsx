import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnrichmentFormByPerfil, enrichmentSectionTitle } from './EnrichmentFormByPerfil';

describe('EnrichmentFormByPerfil', () => {
  afterEach(() => cleanup());

  it('renders hospital form for Hospitalar perfil', () => {
    render(
      <EnrichmentFormByPerfil perfil="Hospitalar" onSubmit={vi.fn()} />,
    );

    expect(screen.getByTestId('enrichment-form')).toBeInTheDocument();
    expect(enrichmentSectionTitle('Hospitalar')).toBe('Enriquecimento hospitalar');
  });

  it('renders APS form and submits payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<EnrichmentFormByPerfil perfil="APS" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Notas de território/i), 'Território norte');
    await user.click(screen.getByRole('button', { name: /Salvar enriquecimento/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ notas_territorio: 'Território norte' }),
      );
    });
  });

  it('renders MAC form', () => {
    render(<EnrichmentFormByPerfil perfil="MAC" onSubmit={vi.fn()} />);
    expect(screen.getByTestId('enrichment-form-mac')).toBeInTheDocument();
  });

  it('renders misto form without leitos field', () => {
    render(<EnrichmentFormByPerfil perfil="Misto" onSubmit={vi.fn()} />);

    expect(screen.getByTestId('enrichment-form-misto')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Clínico/i)).not.toBeInTheDocument();
  });

  it('renders Outro form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<EnrichmentFormByPerfil perfil="Outro" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Notas$/i), 'Observação geral');
    await user.click(screen.getByRole('button', { name: /Salvar enriquecimento/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ notas: 'Observação geral' });
    });
  });

  it('shows readonly summary when readOnly is true', () => {
    render(
      <EnrichmentFormByPerfil
        perfil="APS"
        readOnly
        enrichment={{ notas_territorio: 'Zona leste' }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByTestId('enrichment-form-aps-readonly')).toBeInTheDocument();
    expect(screen.getByText('Zona leste')).toBeInTheDocument();
  });
});
