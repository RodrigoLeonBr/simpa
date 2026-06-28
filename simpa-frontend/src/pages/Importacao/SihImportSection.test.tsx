import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SihConflictError,
  getSihSincronizacaoExiste,
  getSihSincronizacoes,
  getSihSyncProgress,
  sincronizarSih,
} from '../../api/sih';
import { SihImportSection } from './SihImportSection';

vi.mock('../../api/sih', async () => {
  const actual = await vi.importActual<typeof import('../../api/sih')>('../../api/sih');
  return {
    ...actual,
    getSihSincronizacoes: vi.fn(),
    getSihSyncProgress: vi.fn(),
    getSihSincronizacaoExiste: vi.fn(),
    sincronizarSih: vi.fn(),
  };
});

const mockSincronizarSih = vi.mocked(sincronizarSih);
const mockGetSihSincronizacoes = vi.mocked(getSihSincronizacoes);
const mockGetSihSyncProgress = vi.mocked(getSihSyncProgress);
const mockGetSihSincronizacaoExiste = vi.mocked(getSihSincronizacaoExiste);

const defaultHistory = [
  {
    id: 1,
    competencia: '2025-01-01',
    status: 'ok' as const,
    qtd_internacoes: 120,
    qtd_procedimentos: 380,
    orphan_cnes: 2,
    erros: 0,
    sincronizado_em: '2025-02-01T10:00:00Z',
  },
];

const defaultSyncResult = {
  sincronizacao_id: 1,
  competencia: '2025-01-01',
  status: 'ok' as const,
  qtd_internacoes: 42,
  qtd_procedimentos: 110,
  orphan_cnes: 1,
  erros: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSihSincronizacoes.mockResolvedValue(defaultHistory);
  mockGetSihSyncProgress.mockRejectedValue(new Error('404'));
  mockGetSihSincronizacaoExiste.mockResolvedValue({
    competencia: '',
    exists: false,
    status: null,
    qtd_internacoes: 0,
    qtd_procedimentos: 0,
  });
  mockSincronizarSih.mockResolvedValue(defaultSyncResult);
});

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('SihImportSection rendering', () => {
  it('renders input type=month with default value = previous month', async () => {
    render(<SihImportSection />);
    const input = screen.getByTestId('sih-import-competencia') as HTMLInputElement;
    expect(input.type).toBe('month');
    expect(input.value).toMatch(/^\d{4}-\d{2}$/);
  });

  it('renders Import button with correct data-testid', () => {
    render(<SihImportSection />);
    expect(screen.getByTestId('sih-import-btn')).toBeInTheDocument();
    expect(screen.getByTestId('sih-import-btn')).toHaveTextContent('Importar internações AIH');
  });

  it('renders history table with sih-history-table testid', async () => {
    render(<SihImportSection />);
    await waitFor(() => {
      expect(screen.getByTestId('sih-history-table')).toBeInTheDocument();
    });
  });

  it('renders history rows with competencia, status, qtd_internacoes', async () => {
    render(<SihImportSection />);
    await waitFor(() => {
      expect(screen.getByTestId('sih-history-table')).toHaveTextContent('2025-01');
      expect(screen.getByTestId('sih-history-table')).toHaveTextContent('120');
    });
  });

  it('shows "já importada" badge when competencia exists', async () => {
    mockGetSihSincronizacaoExiste.mockResolvedValue({
      competencia: '2025-01',
      exists: true,
      status: 'ok',
      qtd_internacoes: 120,
      qtd_procedimentos: 380,
      sincronizado_em: '2025-02-01T10:00:00Z',
    });
    render(<SihImportSection />);
    await waitFor(() => {
      expect(screen.getByTestId('sih-import-badge-importada')).toBeInTheDocument();
      expect(screen.getByTestId('sih-import-badge-importada')).toHaveTextContent('Já importada');
    });
  });
});

// ---------------------------------------------------------------------------
// Import action
// ---------------------------------------------------------------------------

describe('SihImportSection import action', () => {
  it('calls sincronizarSih with selected competencia on button click', async () => {
    const user = userEvent.setup();
    render(<SihImportSection />);

    const input = screen.getByTestId('sih-import-competencia') as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '2025-03');

    await user.click(screen.getByTestId('sih-import-btn'));

    expect(mockSincronizarSih).toHaveBeenCalledWith(
      '2025-03',
      expect.objectContaining({ reimportar: undefined }),
    );
  });

  it('disables button while syncing', async () => {
    let resolveSync!: (v: typeof defaultSyncResult) => void;
    const slowSync = new Promise<typeof defaultSyncResult>((res) => {
      resolveSync = res;
    });
    mockSincronizarSih.mockReturnValue(slowSync);

    const user = userEvent.setup();
    render(<SihImportSection />);

    await user.click(screen.getByTestId('sih-import-btn'));
    expect(screen.getByTestId('sih-import-btn')).toBeDisabled();

    resolveSync(defaultSyncResult);
    await waitFor(() => expect(screen.getByTestId('sih-import-btn')).not.toBeDisabled());
  });

  it('shows toast with qtd_internacoes, qtd_procedimentos, orphan_cnes on success', async () => {
    const user = userEvent.setup();
    render(<SihImportSection />);

    await user.click(screen.getByTestId('sih-import-btn'));

    await waitFor(() => {
      const toast = document.querySelector('[data-testid="toast-banner"]');
      expect(toast).toBeInTheDocument();
      expect(toast?.textContent).toMatch(/42 internações/);
      expect(toast?.textContent).toMatch(/110 procedimentos/);
      expect(toast?.textContent).toMatch(/1 CNES sem match/);
    });
  });
});

// ---------------------------------------------------------------------------
// 409 ConfirmDialog
// ---------------------------------------------------------------------------

describe('SihImportSection 409 ConfirmDialog', () => {
  it('shows ConfirmDialog when sincronizarSih throws SihConflictError', async () => {
    const user = userEvent.setup();
    render(<SihImportSection />);
    const input = screen.getByTestId('sih-import-competencia') as HTMLInputElement;
    const comp = input.value;

    mockSincronizarSih.mockRejectedValueOnce(
      new SihConflictError({ competencia: comp, qtd_internacoes: 99, qtd_procedimentos: 250 }),
    );

    await user.click(screen.getByTestId('sih-import-btn'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog').textContent).toMatch(/99 internações/);
    });
  });

  it('ConfirmDialog wrapper has data-testid sih-confirm-dialog', async () => {
    const user = userEvent.setup();
    render(<SihImportSection />);
    const input = screen.getByTestId('sih-import-competencia') as HTMLInputElement;
    const comp = input.value;

    mockSincronizarSih.mockRejectedValueOnce(
      new SihConflictError({ competencia: comp, qtd_internacoes: 50 }),
    );

    await user.click(screen.getByTestId('sih-import-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('sih-confirm-dialog')).toBeInTheDocument();
    });
  });

  it('calls sincronizarSih with reimportar=true when ConfirmDialog is confirmed', async () => {
    const user = userEvent.setup();
    render(<SihImportSection />);

    const input = screen.getByTestId('sih-import-competencia') as HTMLInputElement;
    const currentComp = input.value;

    mockSincronizarSih
      .mockRejectedValueOnce(
        new SihConflictError({ competencia: currentComp, qtd_internacoes: 50 }),
      )
      .mockResolvedValueOnce(defaultSyncResult);

    await user.click(screen.getByTestId('sih-import-btn'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getByTestId('confirm-dialog-action'));

    await waitFor(() => {
      expect(mockSincronizarSih).toHaveBeenCalledTimes(2);
      expect(mockSincronizarSih).toHaveBeenLastCalledWith(
        currentComp,
        expect.objectContaining({ reimportar: true }),
      );
    });
  });

  it('does not call sincronizarSih again when ConfirmDialog is cancelled', async () => {
    const user = userEvent.setup();
    render(<SihImportSection />);
    const input = screen.getByTestId('sih-import-competencia') as HTMLInputElement;
    const comp = input.value;

    mockSincronizarSih.mockRejectedValueOnce(
      new SihConflictError({ competencia: comp, qtd_internacoes: 50 }),
    );

    await user.click(screen.getByTestId('sih-import-btn'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const cancelBtn = screen.getByRole('button', { name: /cancelar/i });
    await user.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(mockSincronizarSih).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 503 MySQL unavailable — error dialog
// ---------------------------------------------------------------------------

describe('SihImportSection 503 MySQL unavailable', () => {
  it('shows error dialog when HTTP 503 is thrown', async () => {
    mockSincronizarSih.mockRejectedValueOnce(new Error('HTTP 503'));

    const user = userEvent.setup();
    render(<SihImportSection />);

    await user.click(screen.getByTestId('sih-import-btn'));

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toMatch(/XAMPP/i);
      expect(dialog.textContent).toMatch(/indisponível/i);
    });
  });

  it('shows error dialog when result.error is SIH_MYSQL_UNAVAILABLE', async () => {
    mockSincronizarSih.mockResolvedValueOnce({
      ...defaultSyncResult,
      status: 'erro',
      error: 'SIH_MYSQL_UNAVAILABLE',
    });

    const user = userEvent.setup();
    render(<SihImportSection />);

    await user.click(screen.getByTestId('sih-import-btn'));

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.textContent).toMatch(/indisponível/i);
    });
  });

  it('error dialog closes after clicking OK', async () => {
    mockSincronizarSih.mockRejectedValueOnce(new Error('HTTP 503'));

    const user = userEvent.setup();
    render(<SihImportSection />);

    await user.click(screen.getByTestId('sih-import-btn'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await user.click(screen.getByTestId('confirm-dialog-action'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
