import type { BenchmarkRow, RelatSinteseRow } from './comparativoView';

export interface RelatorioMeta {
  cod: string;
  nomeCurto: string;
  competencia: string;
}

const SEP = ';';

/** Escapa campo p/ CSV: envolve em aspas se contém separador, aspas ou quebra. */
function csvField(value: string): string {
  if (value.includes(SEP) || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvRow(fields: string[]): string {
  return fields.map(csvField).join(SEP);
}

/** Gera CSV (separador `;`, padrão Excel BR) do ranking + síntese. Sem BOM. */
export function buildRelatorioCsv(
  meta: RelatorioMeta,
  rows: BenchmarkRow[],
  sintese: RelatSinteseRow[],
): string {
  const lines = [
    csvRow(['Relatório comparativo entre unidades']),
    csvRow(['Indicador', `${meta.cod} ${meta.nomeCurto}`]),
    csvRow(['Competência', meta.competencia]),
    '',
    csvRow(['#', 'Unidade', 'Tipo', 'Atingimento', 'vs. média']),
    ...rows.map((r) => csvRow([r.rank, r.nome, r.tipo, r.execText, r.diffText])),
    '',
    csvRow(['Síntese municipal']),
    ...sintese.map((s) => csvRow([s.label, s.value])),
  ];
  return lines.join('\r\n');
}

function filename(meta: RelatorioMeta, ext: string): string {
  return `relatorio-${meta.cod}-${meta.competencia}.${ext}`.replace(/\s+/g, '_');
}

/** Baixa CSV com BOM UTF-8 (Excel lê acentos). */
export function downloadRelatorioCsv(
  meta: RelatorioMeta,
  rows: BenchmarkRow[],
  sintese: RelatSinteseRow[],
): void {
  const csv = '﻿' + buildRelatorioCsv(meta, rows, sintese);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename(meta, 'csv');
  link.click();
  URL.revokeObjectURL(url);
}

function esc(value: string): string {
  return value.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

/** HTML imprimível do relatório (conteúdo escapado). */
export function buildRelatorioHtml(
  meta: RelatorioMeta,
  rows: BenchmarkRow[],
  sintese: RelatSinteseRow[],
): string {
  const rankingRows = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.rank)}</td><td>${esc(r.nome)}</td><td>${esc(r.tipo)}</td>` +
        `<td>${esc(r.execText)}</td><td>${esc(r.diffText)}</td></tr>`,
    )
    .join('');
  const sinteseRows = sintese
    .map((s) => `<tr><td>${esc(s.label)}</td><td>${esc(s.value)}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>${esc(filename(meta, 'pdf'))}</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;color:#1f2937;margin:32px;}
  h1{font-size:18px;margin:0 0 4px;} .sub{color:#64748b;font-size:13px;margin:0 0 20px;}
  table{border-collapse:collapse;width:100%;margin-bottom:24px;font-size:13px;}
  th,td{border:1px solid #cbd5e1;padding:6px 10px;text-align:left;}
  th{background:#f1f5f9;}
  h2{font-size:14px;margin:0 0 8px;}
</style></head><body>
<h1>Comparativo entre Unidades</h1>
<p class="sub">${esc(meta.cod)} ${esc(meta.nomeCurto)} · competência ${esc(meta.competencia)}</p>
<table><thead><tr><th>#</th><th>Unidade</th><th>Tipo</th><th>Atingimento</th><th>vs. média</th></tr></thead>
<tbody>${rankingRows}</tbody></table>
<h2>Síntese municipal</h2>
<table><tbody>${sinteseRows}</tbody></table>
</body></html>`;
}

/** Imprime relatório via iframe isolado (browser → Salvar como PDF). */
export function printRelatorioPdf(
  meta: RelatorioMeta,
  rows: BenchmarkRow[],
  sintese: RelatSinteseRow[],
): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  iframe.srcdoc = buildRelatorioHtml(meta, rows, sintese);
  iframe.onload = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
  };
  document.body.appendChild(iframe);
}
