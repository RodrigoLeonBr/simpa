import { describe, expect, it } from 'vitest';
import {
  buildEstabelecimentosQuery,
  buildPaginatedCatalogQuery,
  buildProcedimentosQuery,
  buildFormasQuery,
  buildCbosQuery,
  canEditEnrichment,
  canViewEnrichment,
  formatCatalogCount,
  formatLeitosSummary,
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

  it('allows read-only viewers to see enrichment for supported perfis', () => {
    expect(canViewEnrichment('Hospitalar')).toBe(true);
    expect(canViewEnrichment('APS')).toBe(true);
    expect(canEditEnrichment('Hospitalar', false)).toBe(false);
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

  it('buildPaginatedCatalogQuery omits q when search is empty or whitespace', () => {
    expect(buildPaginatedCatalogQuery('', 1)).toEqual({ limit: '200', page: '1' });
    expect(buildPaginatedCatalogQuery('   ', 2)).toEqual({ limit: '200', page: '2' });
  });

  it('buildPaginatedCatalogQuery trims search and applies page', () => {
    expect(buildPaginatedCatalogQuery('  consulta  ', 4)).toEqual({
      limit: '200',
      page: '4',
      q: 'consulta',
    });
  });

  it('buildPaginatedCatalogQuery merges extra filters', () => {
    expect(buildPaginatedCatalogQuery('ubs', 2, { perfil: 'MAC', status: 'ativo' })).toEqual({
      limit: '200',
      page: '2',
      perfil: 'MAC',
      status: 'ativo',
      q: 'ubs',
    });
  });

  it('buildFormasQuery and buildCbosQuery match paginated catalog shape', () => {
    const expected = { limit: '200', page: '1', q: 'abc' };
    expect(buildFormasQuery('abc')).toEqual(expected);
    expect(buildCbosQuery('abc')).toEqual(expected);
  });

  it('buildEstabelecimentosQuery omits perfil when empty', () => {
    expect(buildEstabelecimentosQuery('', 'termo', 1)).toEqual({
      limit: '200',
      page: '1',
      q: 'termo',
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

  it('formatLeitosSummary shows UTI Adulto for legacy uti', () => {
    expect(formatLeitosSummary({ uti: 3 })).toMatch(/uti_adulto|UTI Adulto/i);
  });

  it('formatLeitosSummary keeps non-legacy keys as-is (backward compatible with existing screens)', () => {
    expect(formatLeitosSummary({ clinico: 10, desconhecido: 2 })).toBe(
      'clinico: 10 · desconhecido: 2',
    );
  });

  it('formatLeitosSummary returns em dash for empty/undefined leitos', () => {
    expect(formatLeitosSummary(undefined)).toBe('—');
    expect(formatLeitosSummary({})).toBe('—');
  });
});
