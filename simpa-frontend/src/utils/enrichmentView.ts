import type { EstabelecimentoEnriquecimento } from '../types/cadastros';

import type { EstabelecimentoPerfil } from '../types/cadastros';

export const LEITOS_KEYS = ['clinico', 'cirurgico', 'obstetrico', 'pediatrico', 'uti'] as const;

export type LeitoKey = (typeof LEITOS_KEYS)[number];

export interface EnrichmentFormValues {
  leitos: Record<LeitoKey, string>;
  especialidades: string;
  habilitacoes: string;
  notas: string;
}

const ENRICHMENT_PERFIS: EstabelecimentoPerfil[] = ['APS', 'MAC', 'Hospitalar', 'Misto', 'Outro'];

export function canViewEnrichment(perfil: EstabelecimentoPerfil): boolean {
  return ENRICHMENT_PERFIS.includes(perfil);
}

export function canEditEnrichment(perfil: EstabelecimentoPerfil, roleAllowed = true): boolean {
  return roleAllowed && canViewEnrichment(perfil);
}

export function enrichmentToFormValues(
  enriquecimento: EstabelecimentoEnriquecimento = {},
): EnrichmentFormValues {
  const leitos = {} as Record<LeitoKey, string>;
  for (const key of LEITOS_KEYS) {
    const value = enriquecimento.leitos?.[key];
    leitos[key] = value === undefined ? '' : String(value);
  }

  return {
    leitos,
    especialidades: (enriquecimento.especialidades ?? []).join('\n'),
    habilitacoes: (enriquecimento.habilitacoes ?? []).join('\n'),
    notas: enriquecimento.notas ?? '',
  };
}

export function parseListField(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formValuesToEnrichment(values: EnrichmentFormValues): EstabelecimentoEnriquecimento {
  const leitos: Record<string, number> = {};
  for (const key of LEITOS_KEYS) {
    const raw = values.leitos[key].trim();
    if (!raw) continue;
    leitos[key] = Number(raw);
  }

  return {
    leitos,
    especialidades: parseListField(values.especialidades),
    habilitacoes: parseListField(values.habilitacoes),
    notas: values.notas.trim(),
  };
}

export function validateEnrichmentForm(values: EnrichmentFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const key of LEITOS_KEYS) {
    const raw = values.leitos[key].trim();
    if (!raw) continue;
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0 || !Number.isInteger(num)) {
      errors[`leitos.${key}`] = 'Deve ser número inteiro ≥ 0';
    }
  }

  return errors;
}

export function buildEstabelecimentosQuery(
  perfil: string,
  q: string,
  page = 1,
): Record<string, string> {
  const query: Record<string, string> = {
    limit: '200',
    page: String(page),
  };
  if (perfil) {
    query.perfil = perfil;
  }
  if (q.trim()) {
    query.q = q.trim();
  }
  return query;
}

export function buildProcedimentosQuery(q: string, page = 1): Record<string, string> {
  const query: Record<string, string> = {
    limit: '200',
    page: String(page),
  };
  if (q.trim()) {
    query.q = q.trim();
  }
  return query;
}

export function formatCatalogCount(shown: number, total: number): string {
  if (total <= shown) {
    return String(total);
  }
  return `${shown} de ${total}`;
}

export function formatLeitosSummary(leitos?: Record<string, number>): string {
  if (!leitos || Object.keys(leitos).length === 0) return '—';
  return Object.entries(leitos)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}
