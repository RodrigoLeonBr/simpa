import { describe, expect, it } from 'vitest';
import {
  apsFormValuesToPayload,
  enrichmentSlugForPerfil,
  hospitalFormValuesToPayload,
  PERFIL_TO_SLUG,
  resolveEstabelecimentoEnrichment,
  validateHospitalEnrichmentForm,
  validateMistoEnrichmentForm,
} from './enrichmentByPerfil';
import type { Estabelecimento } from '../types/cadastros';

describe('enrichmentByPerfil', () => {
  it('maps each perfil to enrichment slug', () => {
    expect(PERFIL_TO_SLUG.Hospitalar).toBe('hospitalar');
    expect(enrichmentSlugForPerfil('Misto')).toBe('misto');
    expect(enrichmentSlugForPerfil('APS')).toBe('aps');
  });

  it('resolves enrichment from enrichment field with legacy fallback', () => {
    const row = {
      enrichment: { notas: 'novo' },
      enriquecimento: { notas: 'legado' },
    } as Estabelecimento;

    expect(resolveEstabelecimentoEnrichment(row)).toEqual({ notas: 'novo' });
  });

  it('hospital form has no leitos validation (managed via vigencias)', () => {
    const errors = validateHospitalEnrichmentForm({
      especialidades: '',
      habilitacoes: '',
      capacidade_notas: '',
      notas: '',
    });

    expect(errors).toEqual({});
  });

  it('misto form has no leitos validation (managed via vigencias)', () => {
    const errors = validateMistoEnrichmentForm({
      capacidades_ambulatoriais: '',
      notas_mac: '',
      notas: '',
    });

    expect(errors).toEqual({});
  });

  it('builds APS payload from form values', () => {
    expect(
      apsFormValuesToPayload({
        notas_territorio: 'Território A',
        cobertura_populacional: '12 mil',
        vinculo_esus: 'Sim',
        prioridades_planejamento: 'Vacinação',
        notas: 'Obs',
      }),
    ).toEqual({
      notas_territorio: 'Território A',
      cobertura_populacional: '12 mil',
      vinculo_esus: 'Sim',
      prioridades_planejamento: 'Vacinação',
      notas: 'Obs',
    });
  });

  it('builds hospital payload including capacidade_notas, without leitos', () => {
    expect(
      hospitalFormValuesToPayload({
        especialidades: 'Cardio\nNeuro',
        habilitacoes: '',
        capacidade_notas: 'Ampliada',
        notas: 'Ok',
      }),
    ).toEqual({
      especialidades: ['Cardio', 'Neuro'],
      habilitacoes: [],
      capacidade_notas: 'Ampliada',
      notas: 'Ok',
    });
  });
});
