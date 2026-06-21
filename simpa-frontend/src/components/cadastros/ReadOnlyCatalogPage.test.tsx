import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UsePaginatedCatalogReturn } from '../../hooks/usePaginatedCatalog';
import { ReadOnlyCatalogPage } from './ReadOnlyCatalogPage';

const COLUMNS = [
  { key: 'codigo', label: 'Código', mono: true },
  { key: 'descricao', label: 'Descrição' },
  { key: 'status', label: 'Status' },
];

function mockCatalog(
  overrides: Partial<UsePaginatedCatalogReturn<{ id: number; codigo: string; descricao: string; status: string }>> = {},
): UsePaginatedCatalogReturn<{ id: number; codigo: string; descricao: string; status: string }> {
  return {
    search: '',
    setSearch: vi.fn(),
    appliedSearch: '',
    page: 1,
    setPage: vi.fn(),
    rows: [],
    total: 0,
    pages: 1,
    loading: false,
    error: null,
    carregar: vi.fn().mockResolvedValue(undefined),
    handleSearch: vi.fn(),
    ...overrides,
  };
}

function renderPage(
  catalog: UsePaginatedCatalogReturn<{ id: number; codigo: string; descricao: string; status: string }>,
) {
  return render(
    <MemoryRouter>
      <ReadOnlyCatalogPage
        title="Formas de Organização"
        subtitle="Somente leitura."
        sectionTitle="Formas ativas"
        columns={COLUMNS}
        catalog={catalog}
        searchPlaceholder="Buscar…"
        emptyMessage="Nenhuma forma encontrada."
        loadingMessage="Carregando formas…"
        testIds={{ page: 'formas-page', search: 'formas-search', pagination: 'formas-pagination' }}
      />
    </MemoryRouter>,
  );
}

describe('ReadOnlyCatalogPage', () => {
  afterEach(() => cleanup());

  it('renders columns and rows when loaded', () => {
    renderPage(
      mockCatalog({
        rows: [{ id: 1, codigo: '01', descricao: 'Ambulatorial', status: 'ativo' }],
        total: 1,
      }),
    );

    expect(screen.getByTestId('formas-page')).toBeInTheDocument();
    expect(screen.getByText('Formas de Organização')).toBeInTheDocument();
    expect(screen.getByText('Ambulatorial')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-readonly-table')).toBeInTheDocument();
  });

  it('shows empty state when rows length is 0', () => {
    renderPage(mockCatalog({ rows: [], total: 0 }));

    expect(screen.getByText('Nenhuma forma encontrada.')).toBeInTheDocument();
    expect(screen.queryByTestId('cadastro-readonly-table')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    renderPage(mockCatalog({ loading: true }));

    expect(screen.getByText('Carregando formas…')).toBeInTheDocument();
  });

  it('shows error state', () => {
    renderPage(mockCatalog({ error: 'Falha ao carregar formas' }));

    expect(screen.getByText('Falha ao carregar formas')).toBeInTheDocument();
  });

  it('calls handleSearch on form submit', async () => {
    const handleSearch = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const user = userEvent.setup();

    renderPage(mockCatalog({ handleSearch }));

    await user.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(handleSearch).toHaveBeenCalled();
  });

  it('renders pagination when pages > 1', async () => {
    const setPage = vi.fn();
    const user = userEvent.setup();

    renderPage(
      mockCatalog({
        rows: [{ id: 1, codigo: '01', descricao: 'A', status: 'ativo' }],
        total: 400,
        pages: 2,
        page: 1,
        setPage,
      }),
    );

    expect(screen.getByTestId('formas-pagination')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(setPage).toHaveBeenCalled();
  });
});
