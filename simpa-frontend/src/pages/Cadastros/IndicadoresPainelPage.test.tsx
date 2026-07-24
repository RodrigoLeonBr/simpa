import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { IndicadoresPainelPage } from './IndicadoresPainelPage';

vi.mock('../../api/painelWidgets', () => ({
  fetchPainelWidgets: vi.fn(),
  fetchPainelMetricas: vi.fn(),
  fetchPainelMetrica: vi.fn(),
  updatePainelWidget: vi.fn(),
  createPainelWidget: vi.fn(),
  inactivatePainelWidget: vi.fn(),
  reorderPainelWidgets: vi.fn(),
  previewPainelWidget: vi.fn(),
  discoverPainelMetricas: vi.fn(),
}));

vi.mock('../../api/cadastros', () => ({
  fetchEstabelecimentosAps: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { fetchPainelWidgets } from '../../api/painelWidgets';
import {
  createPainelWidget,
  discoverPainelMetricas,
  fetchPainelMetrica,
  fetchPainelMetricas,
  inactivatePainelWidget,
  previewPainelWidget,
  reorderPainelWidgets,
  updatePainelWidget,
} from '../../api/painelWidgets';
import { fetchEstabelecimentosAps } from '../../api/cadastros';
import { useAuth } from '../../contexts/AuthContext';
import { EM_DASH } from '../../utils/kpi';

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
    sql_override: null,
    spark_sql_override: null,
    delta_config: null,
    status: 'ativo',
  }));
}

function mockPlanningUser() {
  vi.mocked(useAuth).mockReturnValue({
    token: 'jwt',
    user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  } as never);
}

function mockViewerUser() {
  vi.mocked(useAuth).mockReturnValue({
    token: 'jwt',
    user: { username: 'viewer', nome: 'Viewer', perfil: 'Visualizador' },
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
  } as never);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <IndicadoresPainelPage />
    </MemoryRouter>,
  );
}

describe('IndicadoresPainelPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchEstabelecimentosAps).mockResolvedValue([]);
    vi.mocked(fetchPainelMetrica).mockImplementation(async (id: number) => {
      const metric = buildWidgets(8)[0].metrica!;
      return { ...metric, id } as never;
    });
    vi.mocked(fetchPainelMetricas).mockResolvedValue({
      data: [buildWidgets(1)[0].metrica],
      pagination: { page: 1, limit: 30, total: 1, pages: 1 },
    } as never);
  });

  afterEach(() => {
    cleanup();
  });

  describe('listagem e permissões', () => {
    it('renderiza 8 widgets seed quando API retorna lista', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(8) as never);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('indicadores-painel-table')).toBeInTheDocument();
        expect(screen.getAllByText(/Widget \d+/)).toHaveLength(8);
      });
    });

    it('usuário Planejamento vê botão Editar', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);

      renderPage();

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: 'Editar' })).not.toHaveLength(0);
      });
    });

    it('usuário Visualizador não vê botão Editar', async () => {
      mockViewerUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);

      renderPage();

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
      });
    });

    it('mostra banner de erro quando fetch falha', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockRejectedValue(new Error('Falha API'));

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Falha API')).toBeInTheDocument();
      });
    });

    it('listagem solicita widgets ativos e inativos', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);

      renderPage();

      await waitFor(() => {
        expect(fetchPainelWidgets).toHaveBeenCalledWith(
          expect.objectContaining({ perfil: 'APS', layout: 'A', includeInactive: true }),
        );
      });
    });

    it('troca de layout recarrega widgets do layout selecionado', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue([] as never);

      renderPage();

      await waitFor(() => expect(fetchPainelWidgets).toHaveBeenCalledTimes(1));

      fireEvent.change(screen.getByTestId('indicadores-painel-layout-select'), {
        target: { value: 'B' },
      });

      await waitFor(() => {
        expect(fetchPainelWidgets).toHaveBeenLastCalledWith(
          expect.objectContaining({ perfil: 'APS', layout: 'B', includeInactive: true }),
        );
        expect(screen.getByText('Widgets APS · B · Foco')).toBeInTheDocument();
      });
    });

    it('exibe contagem de ativos e inativos', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue([
        buildWidgets(1)[0],
        { ...buildWidgets(1)[0], id: 2, slug: 'inativo', titulo: 'Widget inativo', status: 'inativo', ordem: 2 },
      ] as never);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('widget-count-summary')).toHaveTextContent('1 ativos · 1 inativos');
      });
    });

    it('linha inativa exibe Reativar e oculta Inativar', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue([
        { ...buildWidgets(1)[0], id: 9, status: 'inativo', titulo: 'Widget inativo' },
      ] as never);

      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('widget-reactivate-9')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument();
      });
    });

    it('Reativar chama updatePainelWidget com status ativo', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets)
        .mockResolvedValueOnce([
          { ...buildWidgets(1)[0], id: 9, status: 'inativo', titulo: 'Widget inativo' },
        ] as never)
        .mockResolvedValueOnce(buildWidgets(1) as never);
      vi.mocked(updatePainelWidget).mockResolvedValue(buildWidgets(1)[0] as never);

      renderPage();

      await waitFor(() => expect(screen.getByTestId('widget-reactivate-9')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('widget-reactivate-9'));

      await waitFor(() => {
        expect(updatePainelWidget).toHaveBeenCalledWith(9, { status: 'ativo' });
      });
    });

    it('move down chama reorder com ids trocados', async () => {
      mockPlanningUser();
      const widgets = buildWidgets(2);
      vi.mocked(fetchPainelWidgets)
        .mockResolvedValueOnce(widgets as never)
        .mockResolvedValueOnce(widgets as never);
      vi.mocked(reorderPainelWidgets).mockResolvedValue(widgets as never);

      renderPage();

      await waitFor(() => expect(screen.getByTestId('widget-move-down-1')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('widget-move-down-1'));

      await waitFor(() => {
        expect(reorderPainelWidgets).toHaveBeenCalledWith({
          perfil: 'APS',
          layout: 'A',
          orderedIds: [2, 1],
        });
      });
    });

    it('mostra estado vazio quando lista de widgets vem vazia', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue([] as never);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Nenhum widget encontrado para APS/A · Cards.')).toBeInTheDocument();
      });
    });

    it('renderiza badge Barra para tipo grafico_barra', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue([
        {
          ...buildWidgets(1)[0],
          tipo: 'grafico_barra',
        },
      ] as never);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Barra')).toBeInTheDocument();
      });
    });

    it('botão Atualizar catálogo oculto para Visualizador', async () => {
      mockViewerUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);

      renderPage();

      await waitFor(() => {
        expect(screen.queryByTestId('discover-catalog-button')).not.toBeInTheDocument();
      });
    });
  });

  describe('formulário create/edit', () => {
    it('submit fica desabilitado quando título está vazio', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(fetchPainelMetricas).mockResolvedValue({
        data: [buildWidgets(1)[0].metrica],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      } as never);

      renderPage();

      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
      fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

      const tituloInput = await screen.findByLabelText('Título');
      fireEvent.change(tituloInput, { target: { value: '' } });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Salvar widget' })).toBeDisabled();
      });
    });

    it('busca métrica com debounce usando q', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(fetchPainelMetricas).mockResolvedValue({
        data: [buildWidgets(1)[0].metrica],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      } as never);

      renderPage();

      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
      fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

      const searchInput = await screen.findByTestId('metric-search-input');
      fireEvent.change(searchInput, { target: { value: 'atend' } });

      await waitFor(() => {
        expect(fetchPainelMetricas).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'atend', limit: 30, page: 1 }),
        );
      });
    });

    it('update com sucesso chama API e fecha diálogo', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(fetchPainelMetricas).mockResolvedValue({
        data: [buildWidgets(1)[0].metrica],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      } as never);
      vi.mocked(updatePainelWidget).mockResolvedValue(buildWidgets(1)[0] as never);

      renderPage();

      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
      fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

      const tituloInput = await screen.findByLabelText('Título');
      fireEvent.change(tituloInput, { target: { value: 'Widget atualizado' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar widget' }));

      await waitFor(() => {
        expect(updatePainelWidget).toHaveBeenCalled();
        expect(screen.queryByTestId('widget-edit-drawer')).not.toBeInTheDocument();
      });
    });

    it('Executar teste no drawer envia rascunho da tela sem widgetId', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(fetchPainelMetricas).mockResolvedValue({
        data: [buildWidgets(1)[0].metrica],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      } as never);
      vi.mocked(previewPainelWidget).mockResolvedValue({
        slug: 'widget-1',
        ordem: 1,
        tipo: 'card',
        titulo: 'Título em rascunho',
        subtitulo: null,
        formato: 'numero',
        value: 99,
        valueLabel: '99',
        isNull: false,
      } as never);

      renderPage();

      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
      fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

      const tituloInput = await screen.findByLabelText('Título');
      fireEvent.change(tituloInput, { target: { value: 'Título em rascunho' } });
      fireEvent.click(screen.getByTestId('widget-edit-preview-run'));

      await waitFor(() => {
        expect(previewPainelWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            widget: expect.objectContaining({
              titulo: 'Título em rascunho',
              metrica_id: 1,
            }),
            scope: expect.objectContaining({ competencia: '2026-05' }),
          }),
        );
        const arg = vi.mocked(previewPainelWidget).mock.calls[0][0] as {
          widgetId?: number;
          widget?: { titulo?: string };
        };
        expect(arg.widgetId).toBeUndefined();
        expect(screen.getByTestId('widget-edit-preview-result')).toHaveTextContent('99');
      });
    });

    it('create com sucesso chama API com slug e fecha diálogo', async () => {
      mockPlanningUser();
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

      renderPage();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Novo widget' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Novo widget' }));

      fireEvent.change(await screen.findByLabelText('Slug'), { target: { value: 'novo-widget' } });
      fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Widget novo' } });
      fireEvent.change(screen.getByLabelText('Métrica principal'), { target: { value: '1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar widget' }));

      await waitFor(() => {
        expect(createPainelWidget).toHaveBeenCalledWith(
          expect.objectContaining({
            slug: 'novo-widget',
            titulo: 'Widget novo',
            metrica_id: 1,
            perfil: 'APS',
            layout: 'A',
          }),
        );
        expect(screen.queryByTestId('widget-edit-drawer')).not.toBeInTheDocument();
      });
    });

    it('inativar chama API somente após confirmação', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(inactivatePainelWidget).mockResolvedValue({ id: 1, status: 'inativo' } as never);

      renderPage();

      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Inativar' }).length).toBe(1));
      fireEvent.click(screen.getByRole('button', { name: 'Inativar' }));

      expect(inactivatePainelWidget).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId('confirm-dialog-action'));

      await waitFor(() => {
        expect(inactivatePainelWidget).toHaveBeenCalledWith(1);
      });
    });

    it('mostra erro de API no formulário quando update falha', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(fetchPainelMetricas).mockResolvedValue({
        data: [buildWidgets(1)[0].metrica],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      } as never);
      vi.mocked(updatePainelWidget).mockRejectedValue(new Error('Falha validação API'));

      renderPage();

      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
      fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

      fireEvent.change(await screen.findByLabelText('Título'), { target: { value: 'Widget inválido' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar widget' }));

      await waitFor(() => {
        expect(updatePainelWidget).toHaveBeenCalled();
        expect(screen.getByText('Falha validação API')).toBeInTheDocument();
        expect(screen.getByTestId('widget-edit-drawer')).toBeInTheDocument();
      });
    });
  });

  describe('pré-visualização', () => {
    it('preview chama previewPainelWidget com competencia 2026-05', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(previewPainelWidget).mockResolvedValue({
        slug: 'widget-1',
        ordem: 1,
        tipo: 'card',
        titulo: 'Widget 1',
        subtitulo: null,
        formato: 'numero',
        value: 120,
        valueLabel: '120',
        isNull: false,
        delta: { label: '+5 vs mês anterior', direction: 'up' },
      } as never);

      renderPage();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Pré-visualizar' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

      const competenciaSelect = await screen.findByTestId('preview-competencia');
      fireEvent.change(competenciaSelect, { target: { value: '2026-05' } });
      fireEvent.click(screen.getByTestId('preview-run-button'));

      await waitFor(() => {
        expect(previewPainelWidget).toHaveBeenCalledWith({
          widgetId: 1,
          scope: { competencia: '2026-05', estabelecimentoId: undefined },
        });
        expect(screen.getByTestId('preview-value')).toHaveTextContent('120');
        expect(screen.getByTestId('preview-delta')).toHaveTextContent('+5 vs mês anterior');
      });
    });

    it('preview exibe ranking para widget grafico_ranking', async () => {
      mockPlanningUser();
      const rankingWidget = {
        ...buildWidgets(8)[7],
        id: 8,
        tipo: 'grafico_ranking' as const,
        titulo: 'Ranking unidades',
      };
      vi.mocked(fetchPainelWidgets).mockResolvedValue([rankingWidget] as never);
      vi.mocked(previewPainelWidget).mockResolvedValue({
        slug: 'widget-8',
        ordem: 8,
        tipo: 'grafico_ranking',
        titulo: 'Ranking unidades',
        subtitulo: null,
        formato: 'numero',
        value: null,
        valueLabel: '—',
        isNull: false,
        ranking: [
          { label: 'UBS A', valor: 30, valueLabel: '30' },
          { label: 'UBS B', valor: 20, valueLabel: '20' },
        ],
      } as never);

      renderPage();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Pré-visualizar' })).toBeInTheDocument());
      fireEvent.click(screen.getAllByRole('button', { name: 'Pré-visualizar' })[0]);
      fireEvent.click(await screen.findByTestId('preview-run-button'));

      await waitFor(() => {
        expect(screen.getByTestId('preview-ranking')).toBeInTheDocument();
        expect(screen.getByText('UBS A')).toBeInTheDocument();
        expect(screen.getByText('UBS B')).toBeInTheDocument();
        expect(screen.queryByTestId('preview-value')).not.toBeInTheDocument();
      });
    });

    it('preview exibe série para widget grafico_linha', async () => {
      mockPlanningUser();
      const lineWidget = {
        ...buildWidgets(8)[6],
        id: 7,
        tipo: 'grafico_linha' as const,
        titulo: 'Tendência',
      };
      vi.mocked(fetchPainelWidgets).mockResolvedValue([lineWidget] as never);
      vi.mocked(previewPainelWidget).mockResolvedValue({
        slug: 'widget-7',
        ordem: 7,
        tipo: 'grafico_linha',
        titulo: 'Tendência',
        subtitulo: null,
        formato: 'numero',
        value: null,
        valueLabel: '—',
        isNull: false,
        series: [
          { competencia: '2026-04', valor: 10 },
          { competencia: '2026-05', valor: 15 },
        ],
      } as never);

      renderPage();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Pré-visualizar' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
      fireEvent.click(await screen.findByTestId('preview-run-button'));

      await waitFor(() => {
        const seriesList = screen.getByTestId('preview-series');
        expect(seriesList).toBeInTheDocument();
        expect(seriesList).toHaveTextContent('2026-05');
        expect(seriesList).toHaveTextContent('15');
      });
    });

    it('painel SQL renderiza sql_preview quando expandido', async () => {
      mockPlanningUser();
      const widget = {
        ...buildWidgets(1)[0],
        sql_preview: 'SELECT count(*) FROM esus WHERE competencia = :competencia',
      };
      vi.mocked(fetchPainelWidgets).mockResolvedValue([widget] as never);

      renderPage();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Pré-visualizar' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

      const details = await screen.findByTestId('widget-sql-details');
      fireEvent.click(details.querySelector('summary')!);

      await waitFor(() => {
        expect(screen.getByTestId('widget-sql-preview')).toHaveTextContent(
          'SELECT count(*) FROM esus WHERE competencia = :competencia',
        );
      });
    });

    it('erro no preview exibe toast', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(previewPainelWidget).mockRejectedValue(new Error('Falha preview API'));

      renderPage();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Pré-visualizar' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
      fireEvent.click(await screen.findByTestId('preview-run-button'));

      await waitFor(() => {
        expect(screen.getByTestId('toast-banner')).toHaveTextContent('Falha preview API');
      });
    });

    it('preview envia estabelecimentoId quando unidade selecionada', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(fetchEstabelecimentosAps).mockResolvedValue([
        { id: 42, nome: 'UBS Centro', cnes: '123', perfil: 'APS', status: 'ativo' },
      ] as never);
      vi.mocked(previewPainelWidget).mockResolvedValue({
        slug: 'widget-1',
        ordem: 1,
        tipo: 'card',
        titulo: 'Widget 1',
        subtitulo: null,
        formato: 'numero',
        value: 10,
        valueLabel: '10',
        isNull: false,
      } as never);

      renderPage();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Pré-visualizar' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

      const estabelecimentoSelect = await screen.findByTestId('preview-estabelecimento');
      await waitFor(() => expect(estabelecimentoSelect).not.toBeDisabled());
      fireEvent.change(estabelecimentoSelect, { target: { value: '42' } });
      fireEvent.click(screen.getByTestId('preview-run-button'));

      await waitFor(() => {
        expect(previewPainelWidget).toHaveBeenCalledWith({
          widgetId: 1,
          scope: { competencia: '2026-05', estabelecimentoId: 42 },
        });
      });
    });

    it('preview isNull exibe em-dash e badge não apurado', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(previewPainelWidget).mockResolvedValue({
        slug: 'widget-1',
        ordem: 1,
        tipo: 'card',
        titulo: 'Widget 1',
        subtitulo: null,
        formato: 'numero',
        value: null,
        valueLabel: EM_DASH,
        isNull: true,
      } as never);

      renderPage();

      await waitFor(() => expect(screen.getByRole('button', { name: 'Pré-visualizar' })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
      fireEvent.click(await screen.findByTestId('preview-run-button'));

      await waitFor(() => {
        expect(screen.getByTestId('preview-value-null')).toHaveTextContent(EM_DASH);
        expect(screen.getByText('Não apurado')).toBeInTheDocument();
      });
    });
  });

  describe('descoberta de catálogo', () => {
    it('click em Atualizar catálogo chama discoverPainelMetricas uma vez', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(discoverPainelMetricas).mockResolvedValue({
        inserted: 3,
        updated: 7,
        sources: {
          esus_raw: { inserted: 2, updated: 4 },
          sia: { inserted: 1, updated: 2 },
          sih: { inserted: 0, updated: 1 },
        },
      });

      renderPage();

      await waitFor(() => expect(screen.getByTestId('discover-catalog-button')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('discover-catalog-button'));

      await waitFor(() => {
        expect(discoverPainelMetricas).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('toast-banner')).toHaveTextContent(
          'Catálogo atualizado — 3 inseridas, 7 atualizadas (e-SUS: 2/4 · SIA: 1/2 · SIHD: 0/1)',
        );
      });
    });

    it('erro na descoberta exibe toast', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(discoverPainelMetricas).mockRejectedValue(new Error('Falha descoberta'));

      renderPage();

      await waitFor(() => expect(screen.getByTestId('discover-catalog-button')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('discover-catalog-button'));

      await waitFor(() => {
        expect(screen.getByTestId('toast-banner')).toHaveTextContent('Falha descoberta');
      });
    });

    it('erro genérico na descoberta usa mensagem padrão', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(discoverPainelMetricas).mockRejectedValue('falha');

      renderPage();

      await waitFor(() => expect(screen.getByTestId('discover-catalog-button')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('discover-catalog-button'));

      await waitFor(() => {
        expect(screen.getByTestId('toast-banner')).toHaveTextContent('Falha ao atualizar catálogo');
      });
    });

    it('descoberta com drawer aberto mantém drawer visível', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(discoverPainelMetricas).mockResolvedValue({ inserted: 1, updated: 0 });

      renderPage();

      await waitFor(() => expect(screen.getAllByRole('button', { name: 'Editar' }).length).toBe(1));
      fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
      await waitFor(() => expect(screen.getByTestId('widget-edit-drawer')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('discover-catalog-button'));

      await waitFor(() => {
        expect(discoverPainelMetricas).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('widget-edit-drawer')).toBeInTheDocument();
      });
    });

    it('botão Atualizar catálogo fica desabilitado durante requisição', async () => {
      mockPlanningUser();
      vi.mocked(fetchPainelWidgets).mockResolvedValue(buildWidgets(1) as never);
      vi.mocked(discoverPainelMetricas).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ inserted: 0, updated: 0 }), 50);
          }),
      );

      renderPage();

      await waitFor(() => expect(screen.getByTestId('discover-catalog-button')).toBeInTheDocument());
      const button = screen.getByTestId('discover-catalog-button');
      fireEvent.click(button);

      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('Atualizando catálogo…');

      await waitFor(() => {
        expect(button).not.toBeDisabled();
        expect(button).toHaveTextContent('Atualizar catálogo');
      });
    });
  });
});
