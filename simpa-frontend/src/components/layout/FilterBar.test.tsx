import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FiltersProvider } from '../../hooks/useFilters';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/cadastros/estabelecimentos?') && url.includes('perfil=APS')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: [
                {
                  id: 1,
                  codigo_externo: 'A',
                  nome: 'Unidade A',
                  perfil: 'APS',
                  status: 'ativo',
                },
                {
                  id: 2,
                  codigo_externo: 'B',
                  nome: 'Unidade B',
                  perfil: 'APS',
                  status: 'inativo',
                },
              ],
              pagination: { page: 1, limit: 200, total: 2, pages: 1 },
            }),
          });
        }
        if (url.includes('/cadastros/equipes?estabelecimento_id=1')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 10,
                codigo: 'E1',
                nome: 'Equipe 1',
                tipo: 'ESF',
                estabelecimento_id: 1,
                status: 'ativo',
              },
            ],
          });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      }),
    );
  });

  it('loads APS estabelecimentos and cascades equipe options', async () => {
    render(
      <FiltersProvider>
        <FilterBar />
      </FiltersProvider>,
    );

    const unidadeSelect = await screen.findByLabelText('Unidade');
    expect(unidadeSelect).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Unidade A' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Unidade B' })).not.toBeInTheDocument();

    const equipeSelect = screen.getByLabelText('Equipe');
    expect(equipeSelect).toBeDisabled();

    await userEvent.selectOptions(unidadeSelect, '1');

    await waitFor(() => {
      expect(equipeSelect).toBeEnabled();
      expect(screen.getByRole('option', { name: 'Equipe 1' })).toBeInTheDocument();
    });

    await userEvent.selectOptions(equipeSelect, '10');
    await userEvent.selectOptions(unidadeSelect, '');

    expect(equipeSelect).toBeDisabled();
  });

  it('updates competencia selection', async () => {
    render(
      <FiltersProvider>
        <FilterBar />
      </FiltersProvider>,
    );

    const competenciaSelect = screen.getByLabelText('Competência');
    await userEvent.selectOptions(competenciaSelect, '2026-04');
    expect(competenciaSelect).toHaveValue('2026-04');
  });
});
