import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchEstabelecimentos,
  updateEnrichmentBySlug,
  updatePerfil,
} from '../../api/cadastros';
import { AuthProvider } from '../../contexts/AuthContext';
import { AUTH_STORAGE_KEY } from '../../types/auth';
import { EstabelecimentosPage } from './EstabelecimentosPage';

vi.mock('../../api/cadastros', async () => {
  const actual = await vi.importActual<typeof import('../../api/cadastros')>('../../api/cadastros');
  return {
    ...actual,
    fetchEstabelecimentos: vi.fn(),
    updatePerfil: vi.fn(),
    updateEnrichmentBySlug: vi.fn(),
  };
});

const hospital = {
  id: 1,
  codigo_externo: 'H001',
  nome: 'Hospital Municipal',
  perfil: 'Hospitalar',
  perfil_editado: false,
  status: 'ativo',
  enrichment: { leitos: { clinico: 5 } },
};

const aps = {
  id: 2,
  codigo_externo: 'U001',
  nome: 'UBS Centro',
  perfil: 'APS',
  perfil_editado: false,
  status: 'ativo',
  enrichment: {},
};

function seedPlanningAuth() {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      token: 'test-token',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
    }),
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/cadastros/estabelecimentos']}>
      <AuthProvider>
        <Routes>
          <Route path="/cadastros/estabelecimentos" element={<EstabelecimentosPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('EstabelecimentosPage', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    seedPlanningAuth();
    vi.mocked(fetchEstabelecimentos).mockResolvedValue({
      data: [hospital, aps],
      pagination: { page: 1, limit: 100, total: 2, pages: 1 },
    });
  });

  it('hides Novo button and shows profile chips including Misto', async () => {
    renderPage();

    expect(await screen.findByTestId('estabelecimentos-page')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Novo' })).not.toBeInTheDocument();
    expect(screen.getByTestId('perfil-chip-APS')).toBeInTheDocument();
    expect(screen.getByTestId('perfil-chip-Misto')).toBeInTheDocument();
    expect(screen.getByText('Hospital Municipal')).toBeInTheDocument();
  });

  it('filters API by profile chip', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Hospital Municipal');
    await user.click(screen.getByTestId('perfil-chip-MAC'));

    await waitFor(() => {
      expect(fetchEstabelecimentos).toHaveBeenLastCalledWith(
        expect.objectContaining({ perfil: 'MAC' }),
      );
    });
  });

  it('Misto chip sets perfil=Misto in list query', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Hospital Municipal');
    await user.click(screen.getByTestId('perfil-chip-Misto'));

    await waitFor(() => {
      expect(fetchEstabelecimentos).toHaveBeenLastCalledWith(
        expect.objectContaining({ perfil: 'Misto' }),
      );
    });
  });

  it('shows total count when catalog exceeds page size', async () => {
    vi.mocked(fetchEstabelecimentos).mockResolvedValue({
      data: [hospital],
      pagination: { page: 1, limit: 200, total: 450, pages: 3 },
    });

    renderPage();

    expect(await screen.findByText('1 de 450')).toBeInTheDocument();
    expect(screen.getByTestId('estabelecimentos-pagination')).toBeInTheDocument();
  });

  it('shows locked synced fields and saves enrichment via slug API without touching leitos', async () => {
    vi.mocked(updateEnrichmentBySlug).mockResolvedValue({
      ...hospital,
      enrichment: { leitos: { clinico: 5 }, notas: 'Nova nota' },
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Hospital Municipal');
    await user.click(screen.getByText('Hospital Municipal'));

    expect(await screen.findByTestId('estabelecimento-detail-drawer')).toBeInTheDocument();
    expect(screen.getByTestId('estabelecimento-nome-input')).toBeEnabled();
    expect(screen.getByTestId('enrichment-form')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Clínico/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Leitos atuais: clinico: 5/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Notas$/i), 'Nova nota');
    await user.click(screen.getByRole('button', { name: /Salvar enriquecimento/i }));

    await waitFor(() => {
      expect(updateEnrichmentBySlug).toHaveBeenCalledWith(1, 'hospitalar', {
        especialidades: [],
        habilitacoes: [],
        capacidade_notas: '',
        notas: 'Nova nota',
      });
      expect(screen.getByText(/Leitos atuais: clinico: 5/i)).toBeInTheDocument();
    });
  });

  it('mock API perfil update refreshes table row', async () => {
    vi.mocked(updatePerfil).mockResolvedValue({
      ...hospital,
      perfil: 'Misto',
      perfil_editado: true,
      enrichment: { leitos: { clinico: 5 } },
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Hospital Municipal');
    await user.click(screen.getByText('Hospital Municipal'));
    await screen.findByTestId('estabelecimento-perfil-select');

    await user.selectOptions(screen.getByTestId('estabelecimento-perfil-select'), 'Misto');
    await user.click(screen.getByRole('button', { name: /Salvar perfil/i }));

    await waitFor(() => {
      expect(updatePerfil).toHaveBeenCalledWith(1, 'Misto');
    });

    await user.click(screen.getByLabelText('Fechar'));
    const table = screen.getByTestId('cadastro-readonly-table');
    expect(table.querySelector('tbody tr:first-child td:nth-child(3)')?.textContent).toBe('Misto');
  });
});
