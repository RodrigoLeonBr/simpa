import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
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
      expect(sincronizarSiaProducao).toHaveBeenCalledWith('2026-05', { reimportar: false });
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
      });
      expect(sincronizarSiaProducao).toHaveBeenNthCalledWith(2, '2026-05', {
        reimportar: true,
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
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/MySQL\/XAMPP indisponível/i);
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
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/Timeout serviço SIA/i);
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
});
