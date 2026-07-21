import type { LeitoResumoKey } from '../types/cadastros';

export const LEITOS_RESUMO_KEYS = [
  'clinico',
  'cirurgico',
  'obstetrico',
  'pediatrico',
  'uti_adulto',
  'uti_neonatal',
] as const;

export type { LeitoResumoKey };

export const LEITO_RESUMO_LABELS: Record<LeitoResumoKey, string> = {
  clinico: 'Clínico',
  cirurgico: 'Cirúrgico',
  obstetrico: 'Obstétrico',
  pediatrico: 'Pediátrico',
  uti_adulto: 'UTI Adulto',
  uti_neonatal: 'UTI Neonatal',
};

export interface LeitoDetalheItem {
  codigo: string;
  descricao: string;
  grupo: LeitoResumoKey;
}

export const LEITOS_DETALHE_CATALOG: LeitoDetalheItem[] = [
  { codigo: '75', descricao: 'UTI-A Tipo II', grupo: 'uti_adulto' },
  { codigo: '81', descricao: 'UTI Neonatal Tipo II', grupo: 'uti_neonatal' },
  { codigo: '03', descricao: 'Cirurgia Geral', grupo: 'cirurgico' },
  { codigo: '13', descricao: 'Ortopedia/Traumatologia', grupo: 'cirurgico' },
  { codigo: '33', descricao: 'Clínica Geral', grupo: 'clinico' },
  { codigo: '10', descricao: 'Obstetrícia Cirúrgica', grupo: 'obstetrico' },
  { codigo: '43', descricao: 'Obstetrícia Clínica', grupo: 'obstetrico' },
  { codigo: '47', descricao: 'Psiquiatria', grupo: 'clinico' },
  { codigo: '68', descricao: 'Pediatria Cirúrgica', grupo: 'pediatrico' },
  { codigo: '45', descricao: 'Pediatria Clínica', grupo: 'pediatrico' },
];

export const DETALHE_CODIGO_TO_GRUPO: Record<string, LeitoResumoKey> =
  LEITOS_DETALHE_CATALOG.reduce((map, item) => {
    map[item.codigo] = item.grupo;
    return map;
  }, {} as Record<string, LeitoResumoKey>);

const VIGENCIA_UI_REGEX = /^\d{2}\/\d{4}$/;

function parseUiPart(value: string): string {
  if (!VIGENCIA_UI_REGEX.test(value)) {
    throw new Error(`Formato de vigência inválido (esperado MM/YYYY): ${value}`);
  }
  if (value === '99/9999') {
    return '999999';
  }
  const [month, year] = value.split('/');
  return `${year}${month}`;
}

export function parseVigenciaUi(
  inicioUi: string,
  fimUi: string,
): { inicio: string; fim: string } {
  return { inicio: parseUiPart(inicioUi), fim: parseUiPart(fimUi) };
}

function formatUiPart(value: string): string {
  if (value === '999999') {
    return '99/9999';
  }
  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  return `${month}/${year}`;
}

export function formatVigenciaUi(
  inicio: string,
  fim: string,
): { inicio: string; fim: string } {
  return { inicio: formatUiPart(inicio), fim: formatUiPart(fim) };
}

export function assertDetalheConsistente(
  leitos: Record<string, number>,
  detalhe: Record<string, number>,
): string | null {
  const hasPositive = Object.values(detalhe).some((value) => Number(value) > 0);
  if (!hasPositive) {
    return null;
  }

  const touchedGroups = new Set<LeitoResumoKey>();
  for (const codigo of Object.keys(detalhe)) {
    const grupo = DETALHE_CODIGO_TO_GRUPO[codigo];
    if (grupo) {
      touchedGroups.add(grupo);
    }
  }

  for (const grupo of LEITOS_RESUMO_KEYS) {
    if (!touchedGroups.has(grupo)) continue;

    let soma = 0;
    for (const [codigo, valor] of Object.entries(detalhe)) {
      if (DETALHE_CODIGO_TO_GRUPO[codigo] === grupo) {
        soma += Number(valor) || 0;
      }
    }

    const resumoValor = typeof leitos[grupo] === 'number' ? leitos[grupo] : 0;

    if (soma !== resumoValor) {
      return `${grupo}: soma do detalhe (${soma}) difere do resumo (${resumoValor})`;
    }
  }

  return null;
}
