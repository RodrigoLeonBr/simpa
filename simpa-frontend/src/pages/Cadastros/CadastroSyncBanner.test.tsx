import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCadastroList,
  fetchUltimaCadastroSync,
  sincronizarCadastros,
} from '../../api/cadastros';
import { CadastroSyncBanner } from './CadastroSyncBanner';
import CadastrosPage from './index';

vi.mock('../../api/cadastros', async () => {
  const actual = await vi.importActual<typeof import('../../api/cadastros')>('../../api/cadastros');
  return {
    ...actual,
    fetchUltimaCadastroSync: vi.fn(),
    sincronizarCadastros: vi.fn(),
  };
});

describe('CadastroSyncBanner', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchUltimaCadastroSync).mockRejectedValue(new Error('404'));
  });

  it('shows degraded message when sync fails with MySQL error', async () => {
    vi.mocked(sincronizarCadastros).mockRejectedValue(
      new Error('MySQL_XAMPP_UNAVAILABLE'),
    );

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cadastros']}>
        <Routes>
          <Route path="/cadastros/*" element={<CadastrosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/MySQL\/XAMPP indisponível/i);
    });
  });

  it('refreshes last-sync badge after successful sync', async () => {
    vi.mocked(sincronizarCadastros).mockResolvedValue({
      status: 'ok',
      estabelecimentos: { inserted: 2, updated: 5, inactivated: 0 },
      procedimentos: { inserted: 10, updated: 20, inactivated: 1 },
      sincronizado_em: '2026-06-20T15:30:00Z',
    });
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

    render(
      <MemoryRouter initialEntries={['/cadastros']}>
        <Routes>
          <Route path="/cadastros/*" element={<CadastrosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('cadastro-sync-ultima')).toHaveTextContent(
        /Nenhuma sincronização/i,
      );
    });

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(sincronizarCadastros).toHaveBeenCalled();
      expect(fetchUltimaCadastroSync).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('cadastro-sync-ultima')).toHaveTextContent(/7 estab/i);
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/Cadastros atualizados/i);
    });
  });

  it('shows degraded fallback and API error toast when sync returns status erro', async () => {
    vi.mocked(sincronizarCadastros).mockResolvedValue({
      status: 'erro',
      error: 'Falha no MySQL do SIA',
      estabelecimentos: { inserted: 0, updated: 0, inactivated: 0 },
      procedimentos: { inserted: 0, updated: 0, inactivated: 0 },
      sincronizado_em: '2026-06-20T15:30:00Z',
    });
    const user = userEvent.setup();

    render(<CadastroSyncBanner />);

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/MySQL\/XAMPP indisponível/i);
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/Falha no MySQL do SIA/i);
    });
  });

  it('handles partial sync by keeping degraded message and refreshing last sync', async () => {
    vi.mocked(sincronizarCadastros).mockResolvedValue({
      status: 'parcial',
      error: 'Alguns registros ignorados',
      estabelecimentos: { inserted: 1, updated: 2, inactivated: 0 },
      procedimentos: { inserted: 3, updated: 4, inactivated: 0 },
      sincronizado_em: '2026-06-20T16:10:00Z',
    });
    vi.mocked(fetchUltimaCadastroSync)
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce({
        id: 2,
        status: 'parcial',
        sincronizado_em: '2026-06-20T16:10:00Z',
        estabelecimentos: { inserted: 1, updated: 2, inactivated: 0 },
        procedimentos: { inserted: 3, updated: 4, inactivated: 0 },
      });
    const user = userEvent.setup();

    render(<CadastroSyncBanner />);

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(fetchUltimaCadastroSync).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('alert')).toHaveTextContent(/Alguns registros ignorados/i);
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/Cadastros atualizados/i);
      expect(screen.getByTestId('cadastro-sync-ultima')).toHaveTextContent(/3 estab/i);
    });
  });

  it('shows generic toast error without degraded alert for non-MySQL failure', async () => {
    vi.mocked(sincronizarCadastros).mockRejectedValue(new Error('Falha timeout API'));
    const user = userEvent.setup();

    render(<CadastroSyncBanner />);

    await user.click(screen.getByTestId('cadastro-sync-button'));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByTestId('toast-banner')).toHaveTextContent(/Falha timeout API/i);
    });
  });
});
