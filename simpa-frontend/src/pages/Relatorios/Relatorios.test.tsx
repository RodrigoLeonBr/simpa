import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RelatoriosPage from './index';

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

vi.mock('../../hooks/useFilters', () => ({
  useFilters: () => ({ competencia: '2026-05' }),
}));

import { useDashboard } from '../../hooks/useDashboard';

describe('Relatorios page', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
        filtros_ativos: { unidade: 'CAFI', equipe: 'EQUIPE 9 EAP' },
        indicadores_qualidade: [
          {
            cod: 'B1',
            nomeCurto: 'Pré-natal',
            nome: 'Pré-natal',
            categoria: 'Componente Qualidade APS',
            meta: 0.6,
            exec: 0.58,
            num: '1',
            den: '2',
            fonte: 'e-SUS',
            periodicidade: 'Quadrimestral',
          },
        ],
      } as never,
      unidades: [
        { id: 1, codigo: 'CAFI001', nome: 'CAFI', tipo: 'APS', status: 'ativo' },
        { id: 2, codigo: 'UBS002', nome: 'UBS JARDIM SAO PAULO', tipo: 'APS', status: 'ativo' },
      ] as never,
      loading: false,
      error: null,
    });
  });

  it('shows toast when export button is clicked', async () => {
    render(
      <MemoryRouter>
        <RelatoriosPage />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('button', { name: '⤓ Excel' }));
    expect(screen.getByTestId('toast-banner')).toHaveTextContent('Em breve');

    await userEvent.click(screen.getByRole('button', { name: '⤓ PDF' }));
    expect(screen.getByTestId('toast-banner')).toHaveTextContent('Em breve');
  });

  it('shows loading and error states', () => {
    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: true,
      error: null,
    });

    const { rerender } = render(
      <MemoryRouter>
        <RelatoriosPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Carregando relatórios…')).toBeInTheDocument();

    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: false,
      error: 'Falha ao carregar',
    });

    rerender(
      <MemoryRouter>
        <RelatoriosPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument();
  });
});
