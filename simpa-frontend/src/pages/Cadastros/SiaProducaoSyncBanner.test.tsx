import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSiaSyncProgress,
  fetchSiaSincronizacaoExiste,
  fetchSiaSincronizacoes,
  sincronizarSiaProducao,
} from '../../api/sia';
import { SiaProducaoSyncBanner } from './SiaProducaoSyncBanner';

vi.mock('../../api/sia', async () => {
  const actual = await vi.importActual<typeof import('../../api/sia')>('../../api/sia');
  return {
    ...actual,
    fetchSiaSincronizacoes: vi.fn(),
    fetchSiaSincronizacaoExiste: vi.fn(),
    fetchSiaSyncProgress: vi.fn(),
    sincronizarSiaProducao: vi.fn(),
  };
});

describe('SiaProducaoSyncBanner', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchSiaSincronizacoes).mockResolvedValue([
      {
        id: 1,
        competencia: '2026-05',
        status: 'ok',
        registros: 8420,
        sincronizado_em: '2026-06-20T15:30:00Z',
      },
    ]);
    vi.mocked(fetchSiaSincronizacaoExiste).mockResolvedValue({
      competencia: '2026-05',
      exists: false,
      status: null,
      registros: 0,
      sincronizado_em: null,
    });
    vi.mocked(fetchSiaSyncProgress).mockResolvedValue({
      executionId: 'test_exec',
      competencia: '2026-05',
      startedAt: '2026-06-24T12:00:00.000Z',
      lastUpdatedAt: '2026-06-24T12:00:00.000Z',
      status: 'running',
      stage: 'extracao_mysql',
      events: [],
    });
  });

  it('renders last sync history when loaded', async () => {
    render(<SiaProducaoSyncBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('sia-sync-history')).toHaveTextContent(/2026-05/i);
      expect(screen.getByTestId('sia-sync-history')).toHaveTextContent(/\(8420\)/i);
    });
  });

  it('shows syncing state while request is running', async () => {
    let resolveSync: ((value: unknown) => void) | null = null;
    const syncPromise = new Promise((resolve) => {
      resolveSync = resolve;
    });
    vi.mocked(sincronizarSiaProducao).mockReturnValue(syncPromise as Promise<any>);

    const user = userEvent.setup();
    render(<SiaProducaoSyncBanner />);

    await user.click(screen.getByTestId('sia-sync-button'));

    expect(screen.getByRole('button', { name: /Importando/i })).toBeDisabled();

    resolveSync?.({
      competencia: '2026-05',
      status: 'ok',
      registros: 120,
      erros: 0,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Importar produção SIA/i })).toBeEnabled();
    });
  });

  it('uses selected month and toasts aggregated row count', async () => {
    vi.mocked(sincronizarSiaProducao).mockResolvedValue({
      competencia: '2026-05',
      status: 'ok',
      registros: 321,
      erros: 0,
    });
    const user = userEvent.setup();
    render(<SiaProducaoSyncBanner />);

    await user.clear(screen.getByTestId('sia-sync-month'));
    await user.type(screen.getByTestId('sia-sync-month'), '2026-05');
    await user.click(screen.getByTestId('sia-sync-button'));

    await waitFor(() => {
      expect(sincronizarSiaProducao).toHaveBeenCalledWith(
        '2026-05',
        expect.objectContaining({ reimportar: false, executionId: expect.any(String) }),
      );
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/321 linhas agregadas/i);
    });
  });

  it('shows confirm dialog on 409 and retries with reimportar true', async () => {
    vi.mocked(sincronizarSiaProducao)
      .mockRejectedValueOnce(new Error('HTTP 409'))
      .mockResolvedValueOnce({
        competencia: '2026-05',
        status: 'ok',
        registros: 999,
        erros: 0,
      });
    const user = userEvent.setup();
    render(<SiaProducaoSyncBanner />);

    await user.clear(screen.getByTestId('sia-sync-month'));
    await user.type(screen.getByTestId('sia-sync-month'), '2026-05');
    await user.click(screen.getByTestId('sia-sync-button'));

    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
    await user.click(screen.getByTestId('confirm-dialog-action'));

    await waitFor(() => {
      expect(sincronizarSiaProducao).toHaveBeenNthCalledWith(1, '2026-05', {
        reimportar: false,
        executionId: expect.any(String),
      });
      expect(sincronizarSiaProducao).toHaveBeenNthCalledWith(2, '2026-05', {
        reimportar: true,
        executionId: expect.any(String),
      });
    });
  });

  it('shows "Já importada" badge when endpoint reports existing sync', async () => {
    vi.mocked(fetchSiaSincronizacaoExiste).mockResolvedValue({
      competencia: '2026-05',
      exists: true,
      status: 'ok',
      registros: 8420,
      sincronizado_em: '2026-06-20T15:30:00Z',
    });

    render(<SiaProducaoSyncBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('sia-sync-badge-importada')).toHaveTextContent(/Já importada/i);
      expect(screen.getByTestId('sia-sync-badge-importada')).toHaveTextContent(/8420/i);
    });
  });

  it('shows degraded alert when API returns status erro with MySQL message', async () => {
    vi.mocked(sincronizarSiaProducao).mockResolvedValue({
      competencia: '2026-05',
      status: 'erro',
      registros: 0,
      erros: 1,
      error: 'MySQL/XAMPP indisponível',
    });
    const user = userEvent.setup();
    render(<SiaProducaoSyncBanner />);

    await user.click(screen.getByTestId('sia-sync-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/MySQL\/XAMPP indisponível/i);
      expect(screen.getByTestId('confirm-dialog')).toHaveTextContent(/Erro na importação SIA/i);
      expect(screen.getByTestId('confirm-dialog')).toHaveTextContent(/MySQL\/XAMPP indisponível/i);
    });

    await user.click(screen.getByTestId('confirm-dialog-action'));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
  });

  it('keeps confirm dialog cancel path and shows toast for non-conflict error', async () => {
    vi.mocked(sincronizarSiaProducao)
      .mockRejectedValueOnce(new Error('HTTP 409'))
      .mockRejectedValueOnce(new Error('Timeout serviço SIA'));
    const user = userEvent.setup();
    render(<SiaProducaoSyncBanner />);

    await user.click(screen.getByTestId('sia-sync-button'));
    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Cancelar/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId('sia-sync-button'));
    await waitFor(() => {
      expect(screen.getByTestId('confirm-dialog')).toHaveTextContent(/Timeout serviço SIA/i);
    });
  });

  it('shows empty history message when fetchSincronizacoes fails', async () => {
    vi.mocked(fetchSiaSincronizacoes).mockRejectedValueOnce(new Error('falha'));
    render(<SiaProducaoSyncBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('sia-sync-history')).toHaveTextContent(
        /Nenhuma sincronização SIA registrada ainda/i,
      );
    });
  });

  it('renders progress panel with events while syncing', async () => {
    vi.mocked(fetchSiaSyncProgress).mockResolvedValue({
      executionId: 'test_exec',
      competencia: '2026-05',
      startedAt: '2026-06-24T12:00:00.000Z',
      lastUpdatedAt: '2026-06-24T12:00:02.000Z',
      status: 'running',
      stage: 'gravar_postgres',
      events: [
        {
          at: '2026-06-24T12:00:01.000Z',
          stage: 'extracao_mysql',
          event: 'extract_block',
          message: 'Bloco 1 extraído do MySQL',
          block_rows: 1000,
        },
      ],
    });
    vi.mocked(sincronizarSiaProducao).mockResolvedValue({
      competencia: '2026-05',
      status: 'ok',
      registros: 1000,
      erros: 0,
    });

    const user = userEvent.setup();
    render(<SiaProducaoSyncBanner />);
    await user.click(screen.getByTestId('sia-sync-button'));

    await waitFor(() => {
      expect(screen.getByTestId('sia-sync-progress-panel')).toBeInTheDocument();
      expect(screen.getByTestId('sia-sync-progress-events')).toHaveTextContent(/Bloco 1 extraído/i);
    });
  });
});
