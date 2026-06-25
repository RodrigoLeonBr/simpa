import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSihSincronizacoes } from '../../api/sih';
import { SihSyncStatusBadge } from './SihSyncStatusBadge';

vi.mock('../../api/sih', async () => {
  const actual = await vi.importActual<typeof import('../../api/sih')>('../../api/sih');
  return { ...actual, getSihSincronizacoes: vi.fn() };
});

const mockGetSih = vi.mocked(getSihSincronizacoes);

function renderBadge() {
  return render(
    <MemoryRouter>
      <SihSyncStatusBadge />
    </MemoryRouter>,
  );
}

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// catalogView — Hospitalar A is now ready
// ---------------------------------------------------------------------------

describe('catalogView Hospitalar status', () => {
  it('isPainelCatalogReady Hospitalar A returns true', async () => {
    const { isPainelCatalogReady } = await import('../../utils/painel/catalogView');
    expect(isPainelCatalogReady('Hospitalar', 'A')).toBe(true);
  });

  it('isPainelCatalogReady Hospitalar B still returns false', async () => {
    const { isPainelCatalogReady } = await import('../../utils/painel/catalogView');
    expect(isPainelCatalogReady('Hospitalar', 'B')).toBe(false);
  });

  it('isPainelCatalogReady Hospitalar C still returns false', async () => {
    const { isPainelCatalogReady } = await import('../../utils/painel/catalogView');
    expect(isPainelCatalogReady('Hospitalar', 'C')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SihSyncStatusBadge — with sync data
// ---------------------------------------------------------------------------

describe('SihSyncStatusBadge with ok sync', () => {
  it('renders data-testid sih-sync-badge', async () => {
    mockGetSih.mockResolvedValue([
      {
        id: 1,
        competencia: '2025-01-01',
        status: 'ok',
        qtd_internacoes: 120,
        qtd_procedimentos: 380,
        orphan_cnes: 0,
        erros: 0,
        sincronizado_em: '2025-02-01T10:00:00Z',
      },
    ]);
    renderBadge();
    await waitFor(() => expect(screen.getByTestId('sih-sync-badge')).toBeInTheDocument());
  });

  it('shows SIHD · AIH label', async () => {
    mockGetSih.mockResolvedValue([
      {
        id: 1,
        competencia: '2025-01-01',
        status: 'ok',
        qtd_internacoes: 120,
        qtd_procedimentos: 380,
        orphan_cnes: 0,
        erros: 0,
        sincronizado_em: '2025-02-01T10:00:00Z',
      },
    ]);
    renderBadge();
    await waitFor(() => {
      expect(screen.getByTestId('sih-sync-badge')).toHaveTextContent('SIHD · AIH');
    });
  });

  it('shows competencia and internacoes count', async () => {
    mockGetSih.mockResolvedValue([
      {
        id: 1,
        competencia: '2025-01-01',
        status: 'ok',
        qtd_internacoes: 120,
        qtd_procedimentos: 380,
        orphan_cnes: 0,
        erros: 0,
        sincronizado_em: '2025-02-01T10:00:00Z',
      },
    ]);
    renderBadge();
    await waitFor(() => {
      expect(screen.getByTestId('sih-sync-badge')).toHaveTextContent('2025-01');
      expect(screen.getByTestId('sih-sync-badge')).toHaveTextContent('120 internações');
    });
  });

  it('contains link to /importacao', async () => {
    mockGetSih.mockResolvedValue([
      {
        id: 1,
        competencia: '2025-01-01',
        status: 'ok',
        qtd_internacoes: 5,
        qtd_procedimentos: 20,
        orphan_cnes: 0,
        erros: 0,
        sincronizado_em: '2025-02-01T10:00:00Z',
      },
    ]);
    renderBadge();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /importar sihd/i });
      expect(link).toHaveAttribute('href', '/importacao');
    });
  });
});

// ---------------------------------------------------------------------------
// SihSyncStatusBadge — empty history
// ---------------------------------------------------------------------------

describe('SihSyncStatusBadge with no sync', () => {
  it('shows "Sem importação" when list is empty', async () => {
    mockGetSih.mockResolvedValue([]);
    renderBadge();
    await waitFor(() => {
      expect(screen.getByTestId('sih-sync-badge')).toHaveTextContent(/sem importação/i);
    });
  });

  it('still shows link to /importacao when no data', async () => {
    mockGetSih.mockResolvedValue([]);
    renderBadge();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /importar sihd/i })).toBeInTheDocument();
    });
  });
});
