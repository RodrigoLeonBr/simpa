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

  it('shows empty state when API returns no rows', async () => {
    vi.mocked(fetchProcedimentos).mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, limit: 100, total: 0, pages: 1 },
    });

    render(
      <MemoryRouter initialEntries={['/cadastros/procedimentos']}>
        <Routes>
          <Route path="/cadastros/procedimentos" element={<ProcedimentosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Nenhum procedimento encontrado.')).toBeInTheDocument();
    expect(screen.queryByTestId('procedimentos-pagination')).not.toBeInTheDocument();
  });

  it('shows API error state when fetch fails', async () => {
    vi.mocked(fetchProcedimentos).mockRejectedValueOnce(new Error('Falha API procedimentos'));

    render(
      <MemoryRouter initialEntries={['/cadastros/procedimentos']}>
        <Routes>
          <Route path="/cadastros/procedimentos" element={<ProcedimentosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Falha API procedimentos')).toBeInTheDocument();
  });

  it('renders pagination and navigates pages', async () => {
    vi.mocked(fetchProcedimentos).mockResolvedValueOnce({
      data: [
        {
          id: 1,
          codigo_sigtap: '0301010072',
          descricao: 'Consulta médica',
          tipo: 'Ambulatorial',
          status: 'ativo',
        },
      ],
      pagination: { page: 1, limit: 100, total: 2, pages: 2 },
    });
    vi.mocked(fetchProcedimentos).mockResolvedValueOnce({
      data: [
        {
          id: 2,
          codigo_sigtap: '0301010099',
          descricao: 'Consulta odontológica',
          tipo: 'Ambulatorial',
          status: 'ativo',
        },
      ],
      pagination: { page: 2, limit: 100, total: 2, pages: 2 },
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cadastros/procedimentos']}>
        <Routes>
          <Route path="/cadastros/procedimentos" element={<ProcedimentosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('procedimentos-pagination')).toBeInTheDocument();
    const previousButton = screen.getByRole('button', { name: 'Anterior' });
    const nextButton = screen.getByRole('button', { name: 'Próxima' });

    expect(previousButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    await user.click(nextButton);

    await waitFor(() => {
      expect(fetchProcedimentos).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: '2' }),
      );
      expect(previousButton).toBeEnabled();
      expect(nextButton).toBeDisabled();
      expect(screen.getByText('Consulta odontológica')).toBeInTheDocument();
    });
  });
});
