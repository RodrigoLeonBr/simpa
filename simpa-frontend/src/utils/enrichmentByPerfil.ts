import type {
  EnrichmentAps,
  EnrichmentBySlug,
  EnrichmentHospitalar,
  EnrichmentMac,
  EnrichmentMisto,
  EnrichmentOutro,
  EnrichmentSlug,
  Estabelecimento,
  EstabelecimentoEnrichment,
  EstabelecimentoPerfil,
} from '../types/cadastros';
import { LEITOS_KEYS, parseListField, type LeitoKey } from './enrichmentView';

export const PERFIL_TO_SLUG: Record<EstabelecimentoPerfil, EnrichmentSlug> = {
  APS: 'aps',
  MAC: 'mac',
  Hospitalar: 'hospitalar',
  Misto: 'misto',
  Outro: 'outro',
};

export const ESTABELECIMENTO_PERFIS: EstabelecimentoPerfil[] = [
  'APS',
  'MAC',
  'Hospitalar',
  'Misto',
  'Outro',
];

export interface HospitalEnrichmentFormValues {
  leitos: Record<LeitoKey, string>;
  especialidades: string;
  habilitacoes: string;
  capacidade_notas: string;
  notas: string;
}

export interface MistoEnrichmentFormValues {
  leitos: Record<LeitoKey, string>;
  capacidades_ambulatoriais: string;
  notas_mac: string;
  notas: string;
}

export interface ApsEnrichmentFormValues {
  notas_territorio: string;
  cobertura_populacional: string;
  vinculo_esus: string;
  prioridades_planejamento: string;
  notas: string;
}

export interface MacEnrichmentFormValues {
  capacidades: string;
  relacionamento_referencia: string;
  autorizacoes: string;
  notas: string;
}

export interface OutroEnrichmentFormValues {
  notas: string;
}

export function resolveEstabelecimentoEnrichment(
  estabelecimento: Estabelecimento,
): EstabelecimentoEnrichment | undefined {
  return estabelecimento.enrichment ?? estabelecimento.enriquecimento;
}

export function enrichmentSlugForPerfil(perfil: EstabelecimentoPerfil): EnrichmentSlug {
  return PERFIL_TO_SLUG[perfil];
}

export function hospitalEnrichmentToFormValues(
  enrichment: EnrichmentHospitalar = {},
): HospitalEnrichmentFormValues {
  const leitos = {} as Record<LeitoKey, string>;
  for (const key of LEITOS_KEYS) {
    const value = enrichment.leitos?.[key];
    leitos[key] = value === undefined ? '' : String(value);
  }

  return {
    leitos,
    especialidades: (enrichment.especialidades ?? []).join('\n'),
    habilitacoes: (enrichment.habilitacoes ?? []).join('\n'),
    capacidade_notas: enrichment.capacidade_notas ?? '',
    notas: enrichment.notas ?? '',
  };
}

export function mistoEnrichmentToFormValues(
  enrichment: EnrichmentMisto = {},
): MistoEnrichmentFormValues {
  const leitos = {} as Record<LeitoKey, string>;
  for (const key of LEITOS_KEYS) {
    const value = enrichment.leitos?.[key];
    leitos[key] = value === undefined ? '' : String(value);
  }

  return {
    leitos,
    capacidades_ambulatoriais: (enrichment.capacidades_ambulatoriais ?? []).join('\n'),
    notas_mac: enrichment.notas_mac ?? '',
    notas: enrichment.notas ?? '',
  };
}

export function apsEnrichmentToFormValues(enrichment: EnrichmentAps = {}): ApsEnrichmentFormValues {
  return {
    notas_territorio: enrichment.notas_territorio ?? '',
    cobertura_populacional: enrichment.cobertura_populacional ?? '',
    vinculo_esus: enrichment.vinculo_esus ?? '',
    prioridades_planejamento: enrichment.prioridades_planejamento ?? '',
    notas: enrichment.notas ?? '',
  };
}

export function macEnrichmentToFormValues(enrichment: EnrichmentMac = {}): MacEnrichmentFormValues {
  return {
    capacidades: (enrichment.capacidades ?? []).join('\n'),
    relacionamento_referencia: enrichment.relacionamento_referencia ?? '',
    autorizacoes: enrichment.autorizacoes ?? '',
    notas: enrichment.notas ?? '',
  };
}

export function outroEnrichmentToFormValues(
  enrichment: EnrichmentOutro = {},
): OutroEnrichmentFormValues {
  return {
    notas: enrichment.notas ?? '',
  };
}

function parseLeitos(values: Record<LeitoKey, string>): Record<string, number> {
  const leitos: Record<string, number> = {};
  for (const key of LEITOS_KEYS) {
    const raw = values[key].trim();
    if (!raw) continue;
    leitos[key] = Number(raw);
  }
  return leitos;
}

export function hospitalFormValuesToPayload(
  values: HospitalEnrichmentFormValues,
): Partial<EnrichmentHospitalar> {
  return {
    leitos: parseLeitos(values.leitos),
    especialidades: parseListField(values.especialidades),
    habilitacoes: parseListField(values.habilitacoes),
    capacidade_notas: values.capacidade_notas.trim(),
    notas: values.notas.trim(),
  };
}

export function mistoFormValuesToPayload(
  values: MistoEnrichmentFormValues,
): Partial<EnrichmentMisto> {
  return {
    leitos: parseLeitos(values.leitos),
    capacidades_ambulatoriais: parseListField(values.capacidades_ambulatoriais),
    notas_mac: values.notas_mac.trim(),
    notas: values.notas.trim(),
  };
}

export function apsFormValuesToPayload(values: ApsEnrichmentFormValues): Partial<EnrichmentAps> {
  return {
    notas_territorio: values.notas_territorio.trim(),
    cobertura_populacional: values.cobertura_populacional.trim(),
    vinculo_esus: values.vinculo_esus.trim(),
    prioridades_planejamento: values.prioridades_planejamento.trim(),
    notas: values.notas.trim(),
  };
}

export function macFormValuesToPayload(values: MacEnrichmentFormValues): Partial<EnrichmentMac> {
  return {
    capacidades: parseListField(values.capacidades),
    relacionamento_referencia: values.relacionamento_referencia.trim(),
    autorizacoes: values.autorizacoes.trim(),
    notas: values.notas.trim(),
  };
}

export function outroFormValuesToPayload(
  values: OutroEnrichmentFormValues,
): Partial<EnrichmentOutro> {
  return {
    notas: values.notas.trim(),
  };
}

export function validateLeitosFields(
  leitos: Record<LeitoKey, string>,
  prefix = 'leitos',
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const key of LEITOS_KEYS) {
    const raw = leitos[key].trim();
    if (!raw) continue;
    const num = Number(raw);
    if (Number.isNaN(num) || num < 0 || !Number.isInteger(num)) {
      errors[`${prefix}.${key}`] = 'Deve ser número inteiro ≥ 0';
    }
  }

  return errors;
}

export function validateHospitalEnrichmentForm(
  values: HospitalEnrichmentFormValues,
): Record<string, string> {
  return validateLeitosFields(values.leitos);
}

export function validateMistoEnrichmentForm(
  values: MistoEnrichmentFormValues,
): Record<string, string> {
  return validateLeitosFields(values.leitos);
}

export function enrichmentSectionTitle(perfil: EstabelecimentoPerfil): string {
  switch (perfil) {
    case 'APS':
      return 'Enriquecimento APS';
    case 'MAC':
      return 'Enriquecimento MAC';
    case 'Hospitalar':
      return 'Enriquecimento hospitalar';
    case 'Misto':
      return 'Enriquecimento misto';
    default:
      return 'Enriquecimento';
  }
}

export type EnrichmentFormPayload = Partial<EnrichmentBySlug[EnrichmentSlug]>;
