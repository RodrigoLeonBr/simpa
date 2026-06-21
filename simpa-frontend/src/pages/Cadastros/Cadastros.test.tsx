import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createCadastro,
  fetchCadastroList,
  fetchEstabelecimentosAps,
  fetchCbos,
  fetchFormas,
  fetchUltimaCadastroSync,
  inactivateCadastro,
  updateCadastro,
} from '../../api/cadastros';
import { CADASTRO_ENTITIES } from '../../config/cadastroEntities';
import { CadastroCrudPage } from '../../components/cadastros/CadastroCrudPage';
import CadastrosPage from './index';
import { AuthProvider } from '../../contexts/AuthContext';

vi.mock('../../api/cadastros', async () => {
  const actual = await vi.importActual<typeof import('../../api/cadastros')>('../../api/cadastros');
  return {
    ...actual,
    fetchCadastroList: vi.fn(),
    createCadastro: vi.fn(),
    updateCadastro: vi.fn(),
    inactivateCadastro: vi.fn(),
    fetchEstabelecimentosAps: vi.fn().mockResolvedValue([]),
    fetchUltimaCadastroSync: vi.fn().mockRejectedValue(new Error('404')),
    fetchFormas: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 200, total: 0, pages: 1 },
    }),
    fetchCbos: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 200, total: 0, pages: 1 },
    }),
  };
});

const emendaConfig = CADASTRO_ENTITIES.find((entity) => entity.key === 'emendas')!;
const equipeConfig = CADASTRO_ENTITIES.find((entity) => entity.key === 'equipes')!;

describe('Cadastros pages', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchCadastroList).mockResolvedValue([]);
    vi.mocked(createCadastro).mockResolvedValue({
      id: 99,
      id_emenda: 'EM999',
      esfera: 'Federal',
      status: 'ativo',
    });
    vi.mocked(inactivateCadastro).mockResolvedValue({ inativado: true, id: 1 });
    vi.mocked(updateCadastro).mockResolvedValue({
      id: 1,
      id_emenda: 'EM001',
      esfera: 'Federal',
      autor: 'Autor Atualizado',
      status: 'ativo',
    });
  });

  it('renders cadastros grid with eight cards and sync banner', () => {
    render(
      <MemoryRouter initialEntries={['/cadastros']}>
        <Routes>
          <Route path="/cadastros/*" element={<CadastrosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('cadastro-grid-page')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-sync-banner')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(8);
    expect(screen.getByTestId('cadastro-card-estabelecimentos')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-card-procedimentos')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-card-formas')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-card-cbos')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-card-equipes')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-card-emendas')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-card-indicadores-painel')).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-card-indicadores-metas')).toBeInTheDocument();
    expect(screen.queryByTestId('cadastro-card-unidades')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cadastro-card-prestadores-mac')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cadastro-card-hospitais')).not.toBeInTheDocument();
  });

  it('resolves /cadastros/formas route without 404', async () => {
    render(
      <MemoryRouter initialEntries={['/cadastros/formas']}>
        <Routes>
          <Route path="/cadastros/*" element={<CadastrosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('formas-page')).toBeInTheDocument();
    expect(screen.getByText('Formas de Organização')).toBeInTheDocument();
    expect(fetchFormas).toHaveBeenCalled();
  });

  it('resolves /cadastros/cbos route without 404', async () => {
    render(
      <MemoryRouter initialEntries={['/cadastros/cbos']}>
        <Routes>
          <Route path="/cadastros/*" element={<CadastrosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('cbos-page')).toBeInTheDocument();
    expect(screen.getByText('CBOs')).toBeInTheDocument();
    expect(fetchCbos).toHaveBeenCalled();
  });

  it('navigates to /cadastros/formas when clicking Formas card', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cadastros']}>
        <Routes>
          <Route path="/cadastros/*" element={<CadastrosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('cadastro-card-formas'));

    expect(await screen.findByTestId('formas-page')).toBeInTheDocument();
    expect(screen.getByText('Formas de Organização')).toBeInTheDocument();
  });

  it('resolves /cadastros/indicadores-painel route without 404', () => {
    render(
      <MemoryRouter initialEntries={['/cadastros/indicadores-painel']}>
        <AuthProvider>
          <Routes>
            <Route path="/cadastros/*" element={<CadastrosPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('indicadores-painel-page')).toBeInTheDocument();
    expect(screen.getByText('Indicadores do Painel')).toBeInTheDocument();
  });

  it('creates emenda and refreshes list with mocked API', async () => {
    vi.mocked(fetchCadastroList)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 99,
          id_emenda: 'EM999',
          esfera: 'Federal',
          status: 'ativo',
        },
      ]);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CadastroCrudPage config={emendaConfig} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Novo' }));
    await user.type(screen.getByLabelText(/ID Emenda/i), 'EM999');
    await user.type(screen.getByLabelText(/Esfera/i), 'Federal');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(createCadastro).toHaveBeenCalledWith('emendas', {
        id_emenda: 'EM999',
        esfera: 'Federal',
      });
      expect(fetchCadastroList).toHaveBeenCalledTimes(2);
      expect(screen.getByText('EM999')).toBeInTheDocument();
    });
  });

  it('requires delete confirmation dialog before inactivating', async () => {
    vi.mocked(fetchCadastroList).mockResolvedValue([
      {
        id: 1,
        id_emenda: 'EM001',
        esfera: 'Federal',
        status: 'ativo',
      },
    ]);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CadastroCrudPage config={emendaConfig} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('EM001')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(inactivateCadastro).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-dialog-action'));

    await waitFor(() => {
      expect(inactivateCadastro).toHaveBeenCalledWith('emendas', 1);
    });
  });

  it('updates emenda on edit submit', async () => {
    vi.mocked(fetchCadastroList)
      .mockResolvedValueOnce([
        {
          id: 1,
          id_emenda: 'EM001',
          esfera: 'Federal',
          autor: 'Autor',
          status: 'ativo',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          id_emenda: 'EM001',
          esfera: 'Federal',
          autor: 'Autor Atualizado',
          status: 'ativo',
        },
      ]);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CadastroCrudPage config={emendaConfig} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('EM001')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Editar' }));
    await user.clear(screen.getByLabelText(/Autor/i));
    await user.type(screen.getByLabelText(/Autor/i), 'Autor Atualizado');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(updateCadastro).toHaveBeenCalledWith('emendas', 1, {
        id_emenda: 'EM001',
        esfera: 'Federal',
        autor: 'Autor Atualizado',
      });
    });
  });

  it('requires inactivate confirmation before soft delete', async () => {
    vi.mocked(fetchCadastroList).mockResolvedValue([
      {
        id: 2,
        id_emenda: 'EM002',
        esfera: 'Estadual',
        status: 'ativo',
      },
    ]);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CadastroCrudPage config={emendaConfig} />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Estadual')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Inativar' }));
    expect(inactivateCadastro).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('confirm-dialog-action'));

    await waitFor(() => {
      expect(inactivateCadastro).toHaveBeenCalledWith('emendas', 2);
    });
  });

  it('creates equipe with estabelecimento_id', async () => {
    vi.mocked(fetchEstabelecimentosAps).mockResolvedValue([
      { id: 1, codigo_externo: 'UBS001', nome: 'UBS Centro', perfil: 'APS', status: 'ativo' },
    ]);
    vi.mocked(fetchCadastroList)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 50,
          codigo: 'EQ050',
          nome: 'ESF Nova',
          tipo: 'ESF',
          estabelecimento_id: 1,
          status: 'ativo',
        },
      ]);
    vi.mocked(createCadastro).mockResolvedValue({
      id: 50,
      codigo: 'EQ050',
      nome: 'ESF Nova',
      tipo: 'ESF',
      estabelecimento_id: 1,
      status: 'ativo',
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CadastroCrudPage config={equipeConfig} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Novo' }));
    await user.type(screen.getByLabelText(/Código e-SUS/i), 'EQ050');
    await user.type(screen.getByLabelText(/^Nome/i), 'ESF Nova');
    await user.selectOptions(screen.getByRole('combobox'), '1');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(createCadastro).toHaveBeenCalledWith('equipes', {
        codigo: 'EQ050',
        nome: 'ESF Nova',
        estabelecimento_id: 1,
      });
    });
  });

  it('shows load error state', async () => {
    vi.mocked(fetchCadastroList).mockRejectedValueOnce(new Error('API offline'));

    render(
      <MemoryRouter>
        <CadastroCrudPage config={emendaConfig} />
      </MemoryRouter>,
    );

    expect(await screen.findByText('API offline')).toBeInTheDocument();
  });
});
