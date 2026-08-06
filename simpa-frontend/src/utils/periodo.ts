// Período do Painel (espelha o backend src/services/periodo.js).
// Formatos: mês `YYYY-MM`, trimestre `YYYY-Tn`, quadrimestre `YYYY-Qn`, ano `YYYY`.

export type PeriodoTipo = 'mes' | 'trimestre' | 'quadrimestre' | 'ano';

export const PERIODO_TIPOS: { id: PeriodoTipo; label: string }[] = [
  { id: 'mes', label: 'Mês' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'quadrimestre', label: 'Quadrimestre' },
  { id: 'ano', label: 'Ano' },
];

const SPAN: Record<'trimestre' | 'quadrimestre', number> = { trimestre: 3, quadrimestre: 4 };
const MAX_INDICE: Record<'trimestre' | 'quadrimestre', number> = { trimestre: 4, quadrimestre: 3 };

export function periodoTipo(periodo: string): PeriodoTipo {
  if (/^\d{4}-T[1-4]$/.test(periodo)) return 'trimestre';
  if (/^\d{4}-Q[1-3]$/.test(periodo)) return 'quadrimestre';
  if (/^\d{4}$/.test(periodo)) return 'ano';
  return 'mes';
}

/** Mês final do período — usado para derivar a competência mensal (páginas não-Painel). */
export function periodoFimCompetencia(periodo: string): string {
  const tipo = periodoTipo(periodo);
  if (tipo === 'mes') return periodo;
  if (tipo === 'ano') return `${periodo}-12`;
  const [ano, resto] = periodo.split('-');
  const idx = Number(resto.slice(1));
  const fimMes = idx * SPAN[tipo];
  return `${ano}-${String(fimMes).padStart(2, '0')}`;
}

export function formatPeriodoLabel(periodo: string): string {
  const tipo = periodoTipo(periodo);
  if (tipo === 'mes') return periodo;
  if (tipo === 'ano') return `Ano ${periodo}`;
  const [ano, resto] = periodo.split('-');
  const idx = resto.slice(1);
  return tipo === 'trimestre' ? `${idx}º trim · ${ano}` : `${idx}º quad · ${ano}`;
}

/** Valores disponíveis para um grão, derivados dos anos presentes nas competências mensais. */
export function buildPeriodoValues(competencias: string[], tipo: PeriodoTipo): string[] {
  if (tipo === 'mes') return competencias;
  const anos = [...new Set(competencias.map((c) => c.slice(0, 4)))].sort().reverse();
  if (tipo === 'ano') return anos;
  const max = MAX_INDICE[tipo];
  const sufixo = tipo === 'trimestre' ? 'T' : 'Q';
  return anos.flatMap((ano) =>
    Array.from({ length: max }, (_, i) => `${ano}-${sufixo}${max - i}`),
  );
}
