import { describe, expect, it } from 'vitest';
import {
  buildEstabelecimentosQuery,
  buildProcedimentosQuery,
  canEditEnrichment,
  formatCatalogCount,
  formValuesToEnrichment,
  validateEnrichmentForm,
  enrichmentToFormValues,
} from './enrichmentView';

describe('enrichmentView', () => {
  it('allows enrichment for all perfis when role allows', () => {
    expect(canEditEnrichment('Hospitalar')).toBe(true);
    expect(canEditEnrichment('Misto')).toBe(true);
    expect(canEditEnrichment('APS')).toBe(true);
    expect(canEditEnrichment('MAC')).toBe(true);
    expect(canEditEnrichment('Outro')).toBe(true);
  });

  it('blocks enrichment when role is not allowed', () => {
    expect(canEditEnrichment('Hospitalar', false)).toBe(false);
    expect(canEditEnrichment('APS', false)).toBe(false);
  });

  it('validates leitos as non-negative integers', () => {
    const values = enrichmentToFormValues();
    values.leitos.clinico = '-1';

    const errors = validateEnrichmentForm(values);
    expect(errors['leitos.clinico']).toMatch(/inteiro/i);
  });

  it('builds estabelecimentos query with perfil filter and pagination', () => {
    expect(buildEstabelecimentosQuery('MAC', 'ubs', 2)).toEqual({
      limit: '200',
      page: '2',
      perfil: 'MAC',
      q: 'ubs',
    });
  });

  it('formats catalog count with total', () => {
    expect(formatCatalogCount(200, 450)).toBe('200 de 450');
    expect(formatCatalogCount(10, 10)).toBe('10');
  });

  it('builds procedimentos query with page', () => {
    expect(buildProcedimentosQuery('consulta', 3)).toEqual({
      limit: '200',
      page: '3',
      q: 'consulta',
    });
  });

  it('maps form values to enrichment payload including clears', () => {
    const values = enrichmentToFormValues({
      leitos: { clinico: 10 },
      notas: 'Observação',
    });
    values.leitos.clinico = '';
    values.notas = '';

    expect(formValuesToEnrichment(values)).toEqual({
      leitos: {},
      especialidades: [],
      habilitacoes: [],
      notas: '',
    });
  });
});
