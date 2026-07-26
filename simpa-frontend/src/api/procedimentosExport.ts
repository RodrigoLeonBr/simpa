const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

export type ExportFormat = 'csv' | 'json';

export interface ExportFilters {
  competencia: string;
  unidade: string;
  equipe: string;
  format?: ExportFormat;
}

/** Build query path for GET /api/procedimentos/export */
export function buildExportPath(filters: ExportFilters): string {
  const format = filters.format || 'csv';
  const params = new URLSearchParams({
    competencia: filters.competencia,
    unidade: filters.unidade,
    equipe: filters.equipe,
    format,
  });
  return `/api/procedimentos/export?${params.toString()}`;
}

export function validateExportFilters(filters: ExportFilters): string | null {
  if (!filters.competencia?.trim()) return 'competencia é obrigatória';
  if (!filters.unidade?.trim()) return 'unidade é obrigatória para exportar';
  if (!filters.equipe?.trim()) return 'equipe é obrigatória para exportar';
  return null;
}

/**
 * Fetch export and trigger browser download (CSV) or return JSON.
 * Returns { ok, error?, filename? }.
 */
export async function downloadProcedimentosExport(
  filters: ExportFilters,
  opts?: { fetchImpl?: typeof fetch; openBlob?: (blob: Blob, filename: string) => void }
): Promise<{ ok: boolean; error?: string; filename?: string; path: string }> {
  const err = validateExportFilters(filters);
  const path = buildExportPath({ ...filters, format: filters.format || 'csv' });
  if (err) return { ok: false, error: err, path };

  const fetchFn = opts?.fetchImpl || fetch;
  const res = await fetchFn(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    return { ok: false, error: body.error || `HTTP ${res.status}`, path };
  }

  const format = filters.format || 'csv';
  const filename =
    format === 'csv'
      ? `procedimentos-mapeados-${filters.competencia}.csv`
      : `procedimentos-mapeados-${filters.competencia}.json`;

  if (format === 'json') {
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    (opts?.openBlob || triggerBlobDownload)(blob, filename);
  } else {
    const blob = await res.blob();
    (opts?.openBlob || triggerBlobDownload)(blob, filename);
  }

  return { ok: true, filename, path };
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
