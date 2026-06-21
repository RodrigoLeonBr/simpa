import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { IndicadoresPainelPage } from './IndicadoresPainelPage';

vi.mock('../../api/painelWidgets', () => ({
  fetchPainelWidgets: vi.fn(),
  fetchPainelMetricas: vi.fn(),
  updatePainelWidget: vi.fn(),
  createPainelWidget: vi.fn(),
  inactivatePainelWidget: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { fetchPainelWidgets } from '../../api/painelWidgets';
import {
  createPainelWidget,
  fetchPainelMetricas,
  inactivatePainelWidget,
  updatePainelWidget,
} from '../../api/painelWidgets';
import { useAuth } from '../../contexts/AuthContext';

function buildWidgets(count: number) {
  return Array.from({ length: count }).map((_, index) => ({
    id: index + 1,
    slug: `widget-${index + 1}`,
    perfil: 'APS',
    layout: 'A',
    ordem: index + 1,
    tipo: index < 6 ? 'card' : index === 6 ? 'grafico_linha' : 'grafico_ranking',
    titulo: `Widget ${index + 1}`,
    subtitulo: null,
    formato: 'numero',
    metrica_id: index + 1,
    metrica: {
      id: index + 1,
      chave: `metrica.${index + 1}`,
      fonte_tipo: 'esus_raw',
      label: `Métrica ${index + 1}`,
      descricao: null,
      tipo_relatorio: null,
      agregacao: 'soma',
      sql_template: 'select 1 as valor',
      ocorrencias: 1,
      status: 'ativo',
    },
    fonte_config: {},
    spark_metrica_id: null,
    spark_config: null,
    sql_preview: null,
    delta_config: null,
    status: 'ativo',
  }));
}

describe('IndicadoresPainelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renderiza 8 widgets seed quando API retorna lista', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(8) as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('indicadores-painel-table')).toBeInTheDocument();
      expect(screen.getAllByText(/Widget \d+/)).toHaveLength(8);
    });
  });

  it('usuário Planejamento vê botão Editar', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Editar' })).not.toHaveLength(0);
    });
  });

  it('usuário Visualizador não vê botão Editar', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'viewer', nome: 'Viewer', perfil: 'Visualizador' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    });
  });

  it('mostra banner de erro quando fetch falha', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockRejectedValue(new Error('Falha API'));

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Falha API')).toBeInTheDocument();
    });
  });

  it('mostra estado vazio quando lista de widgets vem vazia', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue([] as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Nenhum widget encontrado para APS/Layout A.')).toBeInTheDocument();
    });
  });

  it('renderiza badge Barra para tipo grafico_barra', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue([
      {
        ...buildWidgets(1)[0],
        tipo: 'grafico_barra',
      },
    ] as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Barra')).toBeInTheDocument();
    });
  });

  it('submit fica desabilitado quando título está vazio', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
    vi.mocked(fetchPainelMetricas).mockResolvedValue({
      data: [buildWidgets(1)[0].metrica],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    } as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    const tituloInput = await screen.findByLabelText('Título');
    fireEvent.change(tituloInput, { target: { value: '' } });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
    });
  });

  it('busca métrica com debounce usando q', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
    vi.mocked(fetchPainelMetricas).mockResolvedValue({
      data: [buildWidgets(1)[0].metrica],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    } as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    const searchInput = await screen.findByTestId('metric-search-input');
    fireEvent.change(searchInput, { target: { value: 'atend' } });

    await waitFor(() => {
      expect(fetchPainelMetricas).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'atend', limit: 20, page: 1 })
      );
    });
  });

  it('update com sucesso chama API e fecha diálogo', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
    vi.mocked(fetchPainelMetricas).mockResolvedValue({
      data: [buildWidgets(1)[0].metrica],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    } as never);
    vi.mocked(updatePainelWidget).mockResolvedValue(buildWidgets(1)[0] as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    const tituloInput = await screen.findByLabelText('Título');
    fireEvent.change(tituloInput, { target: { value: 'Widget atualizado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(updatePainelWidget).toHaveBeenCalled();
      expect(screen.queryByTestId('form-dialog')).not.toBeInTheDocument();
    });
  });

  it('create com sucesso chama API com slug e fecha diálogo', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue([] as never);
    vi.mocked(fetchPainelMetricas).mockResolvedValue({
      data: [buildWidgets(1)[0].metrica],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    } as never);
    vi.mocked(createPainelWidget).mockResolvedValue({
      ...buildWidgets(1)[0],
      id: 10,
      slug: 'novo-widget',
      titulo: 'Widget novo',
      metrica_id: 1,
    } as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Novo widget' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Novo widget' }));

    fireEvent.change(await screen.findByLabelText('Slug'), { target: { value: 'novo-widget' } });
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Widget novo' } });
    fireEvent.change(screen.getByLabelText('Métrica principal'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(createPainelWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'novo-widget',
          titulo: 'Widget novo',
          metrica_id: 1,
          perfil: 'APS',
          layout: 'A',
        })
      );
      expect(screen.queryByTestId('form-dialog')).not.toBeInTheDocument();
    });
  });

  it('inativar chama API somente após confirmação', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
    vi.mocked(inactivatePainelWidget).mockResolvedValue({ id: 1, status: 'inativo' } as never);

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Inativar' }).length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Inativar' }));

    expect(inactivatePainelWidget).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('confirm-dialog-action'));

    await waitFor(() => {
      expect(inactivatePainelWidget).toHaveBeenCalledWith(1);
    });
  });

  it('mostra erro de API no formulário quando update falha', async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: 'jwt',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
      isAuthenticated: true,
      login: vi.fn(),
      logout: vi.fn(),
    } as never);
    vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
    vi.mocked(fetchPainelMetricas).mockResolvedValue({
      data: [buildWidgets(1)[0].metrica],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    } as never);
    vi.mocked(updatePainelWidget).mockRejectedValue(new Error('Falha validação API'));

    render(
      <MemoryRouter>
        <IndicadoresPainelPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

    fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Widget inválido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(updatePainelWidget).toHaveBeenCalled();
      expect(screen.getByText('Falha validação API')).toBeInTheDocument();
      expect(screen.getByTestId('form-dialog')).toBeInTheDocument();
    });
  });
});
