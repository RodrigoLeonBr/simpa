import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchUltimaCadastroSync,
  computarSyncPlano,
  aplicarSyncPlano,
  sincronizarCadastros,
} from '../../api/cadastros';
import { CadastroSyncBanner } from './CadastroSyncBanner';

vi.mock('../../api/cadastros', async () => {
  const actual = await vi.importActual<typeof import('../../api/cadastros')>('../../api/cadastros');
  return {
    ...actual,
    fetchUltimaCadastroSync: vi.fn(),
    computarSyncPlano: vi.fn(),
    aplicarSyncPlano: vi.fn(),
    sincronizarCadastros: vi.fn(),
  };
});

const emptyPlano = {
  estabelecimentos: [],
  procedimentos: [],
  resumo: {
    estabelecimentos: { novo: 0, alterado: 0, sumiu: 0 },
    procedimentos: { novo: 0, alterado: 0, sumiu: 0 },
  },
  sincronizado_em: '2026-07-28T12:00:00Z',
};

describe('CadastroSyncBanner', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchUltimaCadastroSync).mockRejectedValue(new Error('404'));
  });

  it('shows degraded message when sync fails with MySQL error', async () => {
    vi.mocked(computarSyncPlano).mockRejectedValue(
      new Error('MySQL_XAMPP_UNAVAILABLE'),
    );

    const user = userEvent.setup();
    render(<CadastroSyncBanner />);

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/MySQL\/XAMPP indisponível/i);
    });
  });

  it('shows nada-a-alterar toast when plan has zero changes', async () => {
    vi.mocked(computarSyncPlano).mockResolvedValue(emptyPlano);

    const user = userEvent.setup();
    render(<CadastroSyncBanner />);

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(computarSyncPlano).toHaveBeenCalled();
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/nada a alterar/i);
    });
  });

  it('opens preview when plan has changes', async () => {
    vi.mocked(computarSyncPlano).mockResolvedValue({
      estabelecimentos: [
        { chave: '001', tipo: 'novo', diff: { nome: { mysql: 'UBS A' } } },
      ],
      procedimentos: [],
      resumo: {
        estabelecimentos: { novo: 1, alterado: 0, sumiu: 0 },
        procedimentos: { novo: 0, alterado: 0, sumiu: 0 },
      },
      sincronizado_em: '2026-07-28T12:00:00Z',
    });

    const user = userEvent.setup();
    render(<CadastroSyncBanner />);

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirmar/i })).toBeInTheDocument();
    });
  });

  it('refreshes last-sync badge after applying plan', async () => {
    vi.mocked(computarSyncPlano).mockResolvedValue({
      estabelecimentos: [
        { chave: '001', tipo: 'novo', diff: { nome: { mysql: 'UBS A' } } },
      ],
      procedimentos: [],
      resumo: {
        estabelecimentos: { novo: 1, alterado: 0, sumiu: 0 },
        procedimentos: { novo: 0, alterado: 0, sumiu: 0 },
      },
      sincronizado_em: '2026-07-28T12:00:00Z',
    });
    vi.mocked(aplicarSyncPlano).mockResolvedValue({ aplicados: 1, pulados: 0 });
    vi.mocked(fetchUltimaCadastroSync)
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({
        id: 1,
        status: 'ok',
        sincronizado_em: '2026-06-20T15:30:00Z',
        estabelecimentos: { inserted: 2, updated: 5, inactivated: 0 },
        procedimentos: { inserted: 10, updated: 20, inactivated: 1 },
      });

    const user = userEvent.setup();
    render(<CadastroSyncBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('cadastro-sync-ultima')).toHaveTextContent(
        /Nenhuma sincronização/i,
      );
    });

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /aplicar todos/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /aplicar todos/i }));
    await user.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(aplicarSyncPlano).toHaveBeenCalled();
      expect(fetchUltimaCadastroSync).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('cadastro-sync-ultima')).toHaveTextContent(/7 estab/i);
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/1 aplicados/i);
    });
  });

  it('shows generic toast error without degraded alert for non-MySQL failure', async () => {
    vi.mocked(computarSyncPlano).mockRejectedValue(new Error('Falha timeout API'));
    const user = userEvent.setup();

    render(<CadastroSyncBanner />);

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/Falha timeout API/i);
    });
  });

  it('refs button calls sincronizarCadastros and refreshes badge', async () => {
    vi.mocked(sincronizarCadastros).mockResolvedValue({
      status: 'ok',
      estabelecimentos: { inserted: 0, updated: 0, inactivated: 0 },
      procedimentos: { inserted: 0, updated: 0, inactivated: 0 },
      formas: { inserted: 3, updated: 1, inactivated: 0 },
      cbos: { inserted: 2, updated: 0, inactivated: 0 },
      rubricas: { inserted: 0, updated: 1, inactivated: 0 },
      sincronizado_em: '2026-07-28T12:00:00Z',
    });

    const user = userEvent.setup();
    render(<CadastroSyncBanner />);

    await user.click(screen.getByTestId('cadastro-sync-refs-button'));

    await waitFor(() => {
      expect(sincronizarCadastros).toHaveBeenCalledTimes(1);
      expect(fetchUltimaCadastroSync).toHaveBeenCalledTimes(2); // initial load + after sync
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/referência/i);
    });
  });
});
