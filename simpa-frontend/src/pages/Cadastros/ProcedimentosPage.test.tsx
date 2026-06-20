import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProcedimentos } from '../../api/cadastros';
import { ProcedimentosPage } from './ProcedimentosPage';

vi.mock('../../api/cadastros', async () => {
  const actual = await vi.importActual<typeof import('../../api/cadastros')>('../../api/cadastros');
  return {
    ...actual,
    fetchProcedimentos: vi.fn(),
  };
});

describe('ProcedimentosPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchProcedimentos).mockResolvedValue({
      data: [
        {
          id: 1,
          codigo_sigtap: '0301010072',
          descricao: 'Consulta médica',
          tipo: 'Ambulatorial',
          status: 'ativo',
        },
      ],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });
  });

  it('renders read-only table without create actions', async () => {
    render(
      <MemoryRouter initialEntries={['/cadastros/procedimentos']}>
        <Routes>
          <Route path="/cadastros/procedimentos" element={<ProcedimentosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('procedimentos-page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.getByText('0301010072')).toBeInTheDocument();
  });

  it('searches procedures via API query', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cadastros/procedimentos']}>
        <Routes>
          <Route path="/cadastros/procedimentos" element={<ProcedimentosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Consulta médica');

    await user.type(screen.getByTestId('procedimentos-search'), 'consulta');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(fetchProcedimentos).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'consulta' }),
      );
    });
  });
});
