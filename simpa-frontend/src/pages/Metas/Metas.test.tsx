import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { EM_DASH } from '../../utils/kpi';
import MetasPage from './index';

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

vi.mock('../../hooks/useFilters', () => ({
  useFilters: () => ({ competencia: '2026-05' }),
}));

import { useDashboard } from '../../hooks/useDashboard';

describe('Metas page', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(useDashboard).mockReturnValue({
      data: {
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
          {
            cod: 'C1',
            nomeCurto: 'Acesso',
            nome: 'Acesso',
            categoria: 'Componente Qualidade APS',
            meta: null,
            exec: null,
            num: '—',
            den: '—',
            fonte: 'e-SUS',
            periodicidade: 'Quadrimestral',
          },
        ],
      } as never,
      unidades: [],
      loading: false,
      error: null,
    });
  });

  it('shows atingimento values and em dash for null exec', () => {
    render(
      <MemoryRouter>
        <MetasPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('97%')).toBeInTheDocument();
    expect(screen.getAllByText(EM_DASH).length).toBeGreaterThan(0);
    expect(screen.getByText('Não apurado')).toBeInTheDocument();
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
        <MetasPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Carregando metas…')).toBeInTheDocument();

    vi.mocked(useDashboard).mockReturnValueOnce({
      data: null,
      unidades: [],
      loading: false,
      error: 'Falha ao carregar',
    });

    rerender(
      <MemoryRouter>
        <MetasPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Falha ao carregar')).toBeInTheDocument();
  });
});
