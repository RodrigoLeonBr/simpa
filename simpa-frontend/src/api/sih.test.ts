import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SihConflictError,
  getSihInternacoes,
  getSihProcedimentos,
  getSihSincronizacaoExiste,
  getSihSincronizacoes,
  getSihSyncProgress,
  isSihConflictError,
  sincronizarSih,
} from './sih';

vi.mock('./client', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './client';

const mockApiFetch = vi.mocked(apiFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// sincronizarSih
// ---------------------------------------------------------------------------

describe('sincronizarSih', () => {
  it('POSTs to /api/sih/sincronizar with competencia in body', async () => {
    mockApiFetch.mockResolvedValueOnce({ status: 'ok', competencia: '2025-01', qtd_internacoes: 42 });

    await sincronizarSih('2025-01');

    expect(apiFetch).toHaveBeenCalledWith('/api/sih/sincronizar', {
      method: 'POST',
      body: JSON.stringify({ competencia: '2025-01', reimportar: undefined }),
    });
  });

  it('includes reimportar: true when flag is set', async () => {
    mockApiFetch.mockResolvedValueOnce({ status: 'ok', competencia: '2025-01', qtd_internacoes: 10 });

    await sincronizarSih('2025-01', { reimportar: true });

    expect(apiFetch).toHaveBeenCalledWith('/api/sih/sincronizar', {
      method: 'POST',
      body: JSON.stringify({ competencia: '2025-01', reimportar: true, executionId: undefined }),
    });
  });

  it('throws SihConflictError when apiFetch throws HTTP 409', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('HTTP 409'));

    await expect(sincronizarSih('2025-01')).rejects.toBeInstanceOf(SihConflictError);
  });

  it('SihConflictError has correct code and competencia', async () => {
    mockApiFetch.mockRejectedValueOnce(new Error('HTTP 409'));

    try {
      await sincronizarSih('2025-01');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SihConflictError);
      expect((err as SihConflictError).code).toBe('SIH_COMPETENCIA_JA_IMPORTADA');
      expect((err as SihConflictError).competencia).toBe('2025-01');
    }
  });

  it('re-throws non-409 errors as-is', async () => {
    const networkErr = new Error('Network failure');
    mockApiFetch.mockRejectedValueOnce(networkErr);

    await expect(sincronizarSih('2025-01')).rejects.toBe(networkErr);
  });

  it('returns SihImportResult on success', async () => {
    const mockResult = {
      status: 'ok' as const,
      competencia: '2025-01',
      qtd_internacoes: 80,
      qtd_procedimentos: 200,
      orphan_cnes: 2,
      erros: 0,
    };
    mockApiFetch.mockResolvedValueOnce(mockResult);

    const result = await sincronizarSih('2025-01');

    expect(result.qtd_internacoes).toBe(80);
    expect(result.status).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// isSihConflictError
// ---------------------------------------------------------------------------

describe('isSihConflictError', () => {
  it('returns true for SihConflictError instance', () => {
    const err = new SihConflictError({ competencia: '2025-01' });
    expect(isSihConflictError(err)).toBe(true);
  });

  it('returns true when object has code SIH_COMPETENCIA_JA_IMPORTADA', () => {
    const err = { code: 'SIH_COMPETENCIA_JA_IMPORTADA', competencia: '2025-01' };
    expect(isSihConflictError(err)).toBe(true);
  });

  it('returns false for generic Error', () => {
    expect(isSihConflictError(new Error('HTTP 500'))).toBe(false);
    expect(isSihConflictError(new Error('HTTP 409'))).toBe(false);
  });

  it('returns false for object with different code', () => {
    expect(isSihConflictError({ code: 'OTHER_CODE' })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSihConflictError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSihConflictError(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSihSincronizacaoExiste
// ---------------------------------------------------------------------------

describe('getSihSincronizacaoExiste', () => {
  it('GETs /api/sih/sincronizacoes/existe with competencia query param', async () => {
    mockApiFetch.mockResolvedValueOnce({ exists: false, competencia: '2025-01' });

    await getSihSincronizacaoExiste('2025-01');

    expect(apiFetch).toHaveBeenCalledWith(
      '/api/sih/sincronizacoes/existe?competencia=2025-01',
    );
  });
});

// ---------------------------------------------------------------------------
// getSihSincronizacoes
// ---------------------------------------------------------------------------

describe('getSihSincronizacoes', () => {
  it('GETs /api/sih/sincronizacoes', async () => {
    mockApiFetch.mockResolvedValueOnce([]);
    await getSihSincronizacoes();
    expect(apiFetch).toHaveBeenCalledWith('/api/sih/sincronizacoes');
  });

  it('returns array of SihSincronizacao', async () => {
    const list = [{ id: 1, status: 'ok', qtd_internacoes: 50 }];
    mockApiFetch.mockResolvedValueOnce(list);
    const result = await getSihSincronizacoes();
    expect(result).toHaveLength(1);
    expect(result[0].qtd_internacoes).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// getSihSyncProgress
// ---------------------------------------------------------------------------

describe('getSihSyncProgress', () => {
  it('GETs correct progress URL with encoded executionId', async () => {
    mockApiFetch.mockResolvedValueOnce({ status: 'running', events: [] });

    await getSihSyncProgress('abc-123');

    expect(apiFetch).toHaveBeenCalledWith('/api/sih/sincronizar/progresso/abc-123');
  });
});

// ---------------------------------------------------------------------------
// getSihInternacoes
// ---------------------------------------------------------------------------

describe('getSihInternacoes', () => {
  it('GETs /api/sih/internacoes without params', async () => {
    mockApiFetch.mockResolvedValueOnce([]);
    await getSihInternacoes();
    expect(apiFetch).toHaveBeenCalledWith('/api/sih/internacoes');
  });

  it('GETs /api/sih/internacoes with competencia param', async () => {
    mockApiFetch.mockResolvedValueOnce([]);
    await getSihInternacoes({ competencia: '2025-01' });
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/sih/internacoes?competencia=2025-01',
    );
  });
});

// ---------------------------------------------------------------------------
// getSihProcedimentos
// ---------------------------------------------------------------------------

describe('getSihProcedimentos', () => {
  it('GETs /api/sih/procedimentos without params', async () => {
    mockApiFetch.mockResolvedValueOnce([]);
    await getSihProcedimentos();
    expect(apiFetch).toHaveBeenCalledWith('/api/sih/procedimentos');
  });

  it('GETs /api/sih/procedimentos with competencia param', async () => {
    mockApiFetch.mockResolvedValueOnce([]);
    await getSihProcedimentos({ competencia: '2025-01', estabelecimento_id: 5 });
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/sih/procedimentos?competencia=2025-01&estabelecimento_id=5',
    );
  });
});

// ---------------------------------------------------------------------------
// SihConflictError class
// ---------------------------------------------------------------------------

describe('SihConflictError', () => {
  it('has code SIH_COMPETENCIA_JA_IMPORTADA', () => {
    const err = new SihConflictError({ competencia: '2025-01' });
    expect(err.code).toBe('SIH_COMPETENCIA_JA_IMPORTADA');
  });

  it('has name SihConflictError', () => {
    const err = new SihConflictError({ competencia: '2025-01' });
    expect(err.name).toBe('SihConflictError');
  });

  it('defaults qtd_internacoes and qtd_procedimentos to 0', () => {
    const err = new SihConflictError({ competencia: '2025-01' });
    expect(err.qtd_internacoes).toBe(0);
    expect(err.qtd_procedimentos).toBe(0);
  });

  it('accepts qtd values from constructor', () => {
    const err = new SihConflictError({
      competencia: '2025-01',
      qtd_internacoes: 99,
      qtd_procedimentos: 250,
    });
    expect(err.qtd_internacoes).toBe(99);
    expect(err.qtd_procedimentos).toBe(250);
  });
});
