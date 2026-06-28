import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import {
  deleteMapeamento,
  fetchCargas,
  fetchMapeamentos,
  previewUpload,
  updateMapeamento,
  uploadCargas,
} from '../../api/importacao';
import { fetchEstabelecimentos } from '../../api/cadastros';
import { AuthProvider } from '../../contexts/AuthContext';
import { AUTH_STORAGE_KEY } from '../../types/auth';
import ImportacaoPage from './index';

vi.mock('../../api/importacao', () => ({
  fetchCargas: vi.fn(),
  previewUpload: vi.fn(),
  uploadCargas: vi.fn(),
  fetchMapeamentos: vi.fn(),
  updateMapeamento: vi.fn(),
  deleteMapeamento: vi.fn(),
  reprocessarCarga: vi.fn(),
  substituirCarga: vi.fn(),
  excluirCarga: vi.fn(),
}));

vi.mock('../../api/cadastros', () => ({
  fetchEstabelecimentos: vi.fn(),
  fetchUltimaCadastroSync: vi.fn().mockResolvedValue(null),
  sincronizarCadastros: vi.fn(),
}));

vi.mock('../../api/sia', () => ({
  fetchSiaSincronizacoes: vi.fn().mockResolvedValue([]),
  fetchUltimaSiaSync: vi.fn().mockResolvedValue(null),
  fetchSiaSincronizacaoExiste: vi.fn().mockResolvedValue({ exists: false, status: null, registros: 0, sincronizado_em: null }),
  sincronizarSiaProducao: vi.fn(),
  fetchSiaSyncProgress: vi.fn().mockRejectedValue(new Error('404')),
}));

// SihImportSection (rendered in index.tsx) needs this mock to avoid unhandled rejections.
vi.mock('../../api/sih', async () => {
  const actual = await vi.importActual<typeof import('../../api/sih')>('../../api/sih');
  return {
    ...actual,
    getSihSincronizacoes: vi.fn().mockResolvedValue([]),
    getSihSyncProgress: vi.fn().mockRejectedValue(new Error('404')),
    getSihSincronizacaoExiste: vi.fn().mockResolvedValue({
      competencia: '',
      exists: false,
      status: null,
      qtd_internacoes: 0,
      qtd_procedimentos: 0,
    }),
    sincronizarSih: vi.fn(),
  };
});

const sampleCargas = [
  {
    id: 1,
    tipo_relatorio: 'atendimento_individual',
    competencia: '2026-05-01',
    unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
    equipe_nome: 'EQUIPE 9 EAP',
    arquivo_origem: 'relatorio.csv',
    registros_identificados: 540,
    registros_nao_identificados: 0,
    importado_em: '2026-06-13T17:50:00',
  },
];

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
    <MemoryRouter>
      <AuthProvider>
        <ImportacaoPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Importacao page integration', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    seedPlanningAuth();
    vi.mocked(fetchCargas).mockResolvedValue(sampleCargas);
    vi.mocked(previewUpload).mockResolvedValue([
      {
        nome: 'novo.csv',
        tipo_relatorio: 'atendimento_individual',
        competencia: '2026-05',
        esus_unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
        esus_equipe_nome: 'EQUIPE 9 EAP',
        esus_equipe_codigo: '0009',
        mapeamento_status: 'resolved',
        estabelecimento_id: 42,
        equipe_id: 7,
        ja_importado: false,
      },
    ]);
    vi.mocked(uploadCargas).mockResolvedValue([{ carga_id: 2, status: 'ok' }]);
    vi.mocked(fetchMapeamentos).mockResolvedValue({
      data: [
        {
          id: 1,
          esus_unidade_label: 'CAFI CENTRO',
          esus_equipe_nome: 'EQUIPE 9 EAP',
          estabelecimento_id: 42,
          status: 'ativo',
          estabelecimento_codigo: '7169698',
          estabelecimento_nome: 'CAFI',
        },
      ],
      pagination: { page: 1, limit: 100, total: 1, pages: 1 },
    });
    vi.mocked(fetchEstabelecimentos).mockResolvedValue({
      data: [{ id: 42, codigo_externo: '7169698', nome: 'CAFI', perfil: 'APS', status: 'ativo' }],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    });
  });

  it('upload fixture triggers list refresh', async () => {
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => {
      expect(fetchCargas).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('historico-cargas')).toBeInTheDocument();
    });

    const input = screen.getByTestId('upload-input');
    await user.upload(input, new File(['a,b'], 'novo.csv', { type: 'text/csv' }));

    await waitFor(() => {
      expect(previewUpload).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: /Processar 1 arquivo/i }));

    await waitFor(() => {
      expect(uploadCargas).toHaveBeenCalled();
      expect(vi.mocked(fetchCargas).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows mapeamentos tab for planning staff', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('import-subnav')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('import-tab-mapeamentos'));

    await waitFor(() => {
      expect(fetchMapeamentos).toHaveBeenCalled();
      expect(screen.getByTestId('mapeamentos-panel')).toBeInTheDocument();
      expect(screen.getByTestId('mapeamento-row')).toBeInTheDocument();
    });
  });

  it('inactivates mapping from panel', async () => {
    const user = userEvent.setup();
    vi.mocked(deleteMapeamento).mockResolvedValue({ inativado: true, id: 1 });

    renderPage();
    await user.click(await screen.findByTestId('import-tab-mapeamentos'));
    await screen.findByTestId('mapeamento-row');

    await user.click(screen.getByTestId('mapeamento-delete-1'));
    await user.click(screen.getByTestId('confirm-dialog-action'));

    await waitFor(() => {
      expect(deleteMapeamento).toHaveBeenCalledWith(1);
    });
  });

  it('edits mapping estabelecimento', async () => {
    const user = userEvent.setup();
    vi.mocked(updateMapeamento).mockResolvedValue({
      id: 1,
      esus_unidade_label: 'CAFI CENTRO',
      estabelecimento_id: 42,
      status: 'ativo',
    });

    renderPage();
    await user.click(await screen.findByTestId('import-tab-mapeamentos'));
    await user.click(await screen.findByTestId('mapeamento-edit-1'));
    await user.click(screen.getByTestId('mapeamento-edit-save'));

    await waitFor(() => {
      expect(updateMapeamento).toHaveBeenCalledWith(1, { estabelecimento_id: 42 });
    });
  });
});
