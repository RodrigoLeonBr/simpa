export interface CsvColumn {
  key: string;
  label: string;
}

const SEP = ';';

/** Escapa campo p/ CSV: aspas se contém separador, aspas ou quebra de linha. */
function csvField(value: string): string {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Monta CSV (separador `;`, padrão Excel BR). Header vem de `columns`. */
export function toCsv<T extends object>(columns: CsvColumn[], rows: readonly T[]): string {
  const head = columns.map((c) => csvField(c.label)).join(SEP);
  const body = rows.map((row) => {
    const rec = row as Record<string, unknown>;
    return columns.map((c) => csvField(rec[c.key] == null ? '' : String(rec[c.key]))).join(SEP);
  });
  return [head, ...body].join('\r\n');
}

/** Baixa CSV com BOM UTF-8 (Excel lê acentos). */
export function downloadCsv<T extends object>(
  filename: string,
  columns: CsvColumn[],
  rows: readonly T[],
): void {
  const csv = '﻿' + toCsv(columns, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
