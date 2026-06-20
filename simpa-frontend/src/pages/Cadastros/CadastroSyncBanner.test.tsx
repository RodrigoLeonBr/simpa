import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchCadastroList,
  fetchUltimaCadastroSync,
  sincronizarCadastros,
} from '../../api/cadastros';
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
});
