import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCbos } from '../../api/cadastros';
import { CbosPage } from './CbosPage';

vi.mock('../../api/cadastros', async () => {
  const actual = await vi.importActual<typeof import('../../api/cadastros')>('../../api/cadastros');
  return {
    ...actual,
    fetchCbos: vi.fn(),
  };
});

describe('CbosPage', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCbos).mockResolvedValue({
      data: [
        {
          id: 1,
          codigo_cbo: '223505',
          descricao: 'Enfermeiro',
          status: 'ativo',
        },
      ],
      pagination: { page: 1, limit: 200, total: 1, pages: 1 },
    });
  });

  it('renderiza tabela read-only com colunas esperadas', async () => {
    render(
      <MemoryRouter initialEntries={['/cadastros/cbos']}>
        <Routes>
          <Route path="/cadastros/cbos" element={<CbosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('cbos-page')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Classificação Brasileira de Ocupações sincronizada do MySQL SIA — somente leitura.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('223505')).toBeInTheDocument();
    expect(screen.getByText('Enfermeiro')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo' })).not.toBeInTheDocument();
  });

  it('busca cbos via query q', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cadastros/cbos']}>
        <Routes>
          <Route path="/cadastros/cbos" element={<CbosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Enfermeiro');
    await user.type(screen.getByTestId('cbos-search'), 'enfer');
    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() => {
      expect(fetchCbos).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'enfer' }),
      );
    });
  });

  it('mostra estado de erro amigável', async () => {
    vi.mocked(fetchCbos).mockRejectedValueOnce(new Error('Falha API cbos'));

    render(
      <MemoryRouter initialEntries={['/cadastros/cbos']}>
        <Routes>
          <Route path="/cadastros/cbos" element={<CbosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Falha API cbos')).toBeInTheDocument();
  });

  it('renderiza loading inicial antes da tabela', async () => {
    vi.mocked(fetchCbos).mockImplementation(
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
      <MemoryRouter initialEntries={['/cadastros/cbos']}>
        <Routes>
          <Route path="/cadastros/cbos" element={<CbosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Carregando CBOs…')).toBeInTheDocument();
    expect(await screen.findByText('Nenhum CBO encontrado.')).toBeInTheDocument();
  });

  it('renderiza paginação e navega entre páginas', async () => {
    vi.mocked(fetchCbos).mockResolvedValueOnce({
      data: [
        {
          id: 1,
          codigo_cbo: '223505',
          descricao: 'Enfermeiro',
          status: 'ativo',
        },
      ],
      pagination: { page: 1, limit: 200, total: 2, pages: 2 },
    });
    vi.mocked(fetchCbos).mockResolvedValueOnce({
      data: [
        {
          id: 2,
          codigo_cbo: '223565',
          descricao: 'Enfermeiro de terapia intensiva',
          status: 'ativo',
        },
      ],
      pagination: { page: 2, limit: 200, total: 2, pages: 2 },
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cadastros/cbos']}>
        <Routes>
          <Route path="/cadastros/cbos" element={<CbosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('cbos-pagination')).toBeInTheDocument();
    const nextButton = screen.getByRole('button', { name: 'Próxima' });

    await user.click(nextButton);

    await waitFor(() => {
      expect(fetchCbos).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: '2' }),
      );
      expect(screen.getByText('Enfermeiro de terapia intensiva')).toBeInTheDocument();
    });
  });
});
