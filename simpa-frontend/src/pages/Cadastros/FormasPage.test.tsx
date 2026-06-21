import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFormas } from '../../api/cadastros';
import { FormasPage } from './FormasPage';

vi.mock('../../api/cadastros', async () => {
  const actual = await vi.importActual<typeof import('../../api/cadastros')>('../../api/cadastros');
  return {
    ...actual,
    fetchFormas: vi.fn(),
  };
});

describe('FormasPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchFormas).mockResolvedValue({
      data: [
        {
          id: 1,
          codigo_grupo: '01',
          codigo_subgrupo: '0101',
          codigo_forma: '010101',
          descricao: 'Consulta médica',
          status: 'ativo',
        },
      ],
      pagination: { page: 1, limit: 200, total: 1, pages: 1 },
    });
  });

  it('renderiza tabela read-only com colunas esperadas', async () => {
    render(
      <MemoryRouter initialEntries={['/cadastros/formas']}>
        <Routes>
          <Route path="/cadastros/formas" element={<FormasPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('formas-page')).toBeInTheDocument();
    expect(screen.getByText('Estrutura grupo/subgrupo/forma sincronizada do MySQL SIA — somente leitura.'))
      .toBeInTheDocument();
    expect(screen.getByText('010101')).toBeInTheDocument();
    expect(screen.getByText('Consulta médica')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo' })).not.toBeInTheDocument();
  });

  it('busca formas via query q', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cadastros/formas']}>
        <Routes>
          <Route path="/cadastros/formas" element={<FormasPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Consulta médica');
    await user.type(screen.getByTestId('formas-search'), 'consulta');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(fetchFormas).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'consulta' }),
      );
    });
  });

  it('mostra estado de erro amigável', async () => {
    vi.mocked(fetchFormas).mockRejectedValueOnce(new Error('Falha API formas'));

    render(
      <MemoryRouter initialEntries={['/cadastros/formas']}>
        <Routes>
          <Route path="/cadastros/formas" element={<FormasPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Falha API formas')).toBeInTheDocument();
  });

  it('renderiza loading inicial antes da tabela', async () => {
    vi.mocked(fetchFormas).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                data: [],
                pagination: { page: 1, limit: 200, total: 0, pages: 1 },
              }),
            50,
          ),
        ),
    );

    render(
      <MemoryRouter initialEntries={['/cadastros/formas']}>
        <Routes>
          <Route path="/cadastros/formas" element={<FormasPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Carregando formas…')).toBeInTheDocument();
    expect(await screen.findByText('Nenhuma forma encontrada.')).toBeInTheDocument();
  });

  it('renderiza paginação e navega entre páginas', async () => {
    vi.mocked(fetchFormas).mockResolvedValueOnce({
      data: [
        {
          id: 1,
          codigo_grupo: '01',
          codigo_subgrupo: '0101',
          codigo_forma: '010101',
          descricao: 'Consulta médica',
          status: 'ativo',
        },
      ],
      pagination: { page: 1, limit: 200, total: 2, pages: 2 },
    });
    vi.mocked(fetchFormas).mockResolvedValueOnce({
      data: [
        {
          id: 2,
          codigo_grupo: '01',
          codigo_subgrupo: '0101',
          codigo_forma: '010102',
          descricao: 'Consulta odontológica',
          status: 'ativo',
        },
      ],
      pagination: { page: 2, limit: 200, total: 2, pages: 2 },
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cadastros/formas']}>
        <Routes>
          <Route path="/cadastros/formas" element={<FormasPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('formas-pagination')).toBeInTheDocument();
    const nextButton = screen.getByRole('button', { name: 'Próxima' });

    await user.click(nextButton);

    await waitFor(() => {
      expect(fetchFormas).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: '2' }),
      );
      expect(screen.getByText('Consulta odontológica')).toBeInTheDocument();
    });
  });
});
