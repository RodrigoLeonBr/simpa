import { describe, it, expect, vi } from 'vitest';
import {
  buildExportPath,
  downloadProcedimentosExport,
  validateExportFilters,
} from './procedimentosExport';

describe('procedimentosExport helper', () => {
  it('buildExportPath requests /api/procedimentos/export with competencia and format=csv', () => {
    const path = buildExportPath({
      competencia: '2026-05',
      unidade: 'CAFI',
      equipe: 'EQUIPE 9 EAP',
      format: 'csv',
    });
    expect(path.startsWith('/api/procedimentos/export?')).toBe(true);
    expect(path).toContain('competencia=2026-05');
    expect(path).toContain('format=csv');
    expect(path).toContain('unidade=CAFI');
    expect(path).toContain('equipe=EQUIPE');
  });

  it('validateExportFilters requires unidade and equipe', () => {
    expect(
      validateExportFilters({ competencia: '2026-05', unidade: '', equipe: 'X' })
    ).toMatch(/unidade/);
    expect(
      validateExportFilters({ competencia: '2026-05', unidade: 'U', equipe: '' })
    ).toMatch(/equipe/);
  });

  it('downloadProcedimentosExport triggers blob download path (mocked fetch)', async () => {
    const openBlob = vi.fn();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(['competencia,unidade\n'], { type: 'text/csv' }),
      json: async () => [],
    })) as unknown as typeof fetch;

    const result = await downloadProcedimentosExport(
      {
        competencia: '2026-05',
        unidade: 'CAFI',
        equipe: 'EQUIPE 9 EAP',
        format: 'csv',
      },
      { fetchImpl, openBlob }
    );

    expect(result.ok).toBe(true);
    expect(result.path).toContain('/api/procedimentos/export?');
    expect(result.path).toContain('format=csv');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('/api/procedimentos/export?')
    );
    expect(openBlob).toHaveBeenCalledOnce();
    expect(result.filename).toBe('procedimentos-mapeados-2026-05.csv');
  });
});
