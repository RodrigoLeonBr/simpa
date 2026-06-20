import { describe, expect, it, vi } from 'vitest';
import type { CargaEsus } from '../types/contrato';
import type { PreviewCargaEnriquecida } from '../types/importacao';
import {
  buildCargaStatus,
  buildConflitoTodasMessage,
  buildMappingStatusLabel,
  buildResolucoesUpload,
  canEnableProcess,
  countPendingCargas,
  defaultDraftFromPreview,
  filterCsvFiles,
  formatCadastroTargetLabel,
  hasEstabelecimentoSugestoes,
  isCsvFile,
  isPreviewCargaEnriquecida,
  isRowReadyForProcess,
  needsTodasConfirmation,
  parsePreviewResponse,
  previewEquipeLabel,
  previewUnidadeLabel,
} from './importacaoView';

describe('importacaoView', () => {
  it('accepts only csv files', () => {
    expect(isCsvFile(new File(['a'], 'relatorio.csv', { type: 'text/csv' }))).toBe(true);
    expect(isCsvFile(new File(['a'], 'relatorio.CSV', { type: 'text/csv' }))).toBe(true);
    expect(isCsvFile(new File(['a'], 'relatorio.xlsx', { type: 'application/vnd.ms-excel' }))).toBe(false);
  });

  it('filters non-csv files from selection', () => {
    const files = [
      new File(['a'], 'ok.csv', { type: 'text/csv' }),
      new File(['b'], 'bad.txt', { type: 'text/plain' }),
    ];

    expect(filterCsvFiles(files)).toHaveLength(1);
    expect(filterCsvFiles(files)[0]?.name).toBe('ok.csv');
  });

  it('builds carga status badges', () => {
    expect(buildCargaStatus(null, null).label).toBe('Processando');
    expect(buildCargaStatus(10, 2).label).toBe('Parcial');
    expect(buildCargaStatus(10, 0).label).toBe('OK');
  });

  it('counts pending cargas without identified records', () => {
    const cargas = [
      { id: 1, registros_identificados: 10 } as CargaEsus,
      { id: 2, registros_identificados: null } as CargaEsus,
    ];

    expect(countPendingCargas(cargas)).toBe(1);
  });

  it('formats competencia and import dates safely', async () => {
    const { formatCompetencia, formatImportDate, formatTipoRelatorio } = await import('./importacaoView');

    expect(formatCompetencia(undefined)).toBe('—');
    expect(formatCompetencia('2026-05-01')).toBe('2026-05');
    expect(formatTipoRelatorio('atendimento_individual')).toBe('atendimento individual');
    expect(formatImportDate('2026-06-13T17:50:00')).toContain('2026');
  });

  it("buildMappingStatusLabel('pending') returns user-visible pending text", () => {
    expect(buildMappingStatusLabel('pending')).toMatch(/pendente/i);
    expect(buildMappingStatusLabel('resolved')).toMatch(/vinculado/i);
    expect(buildMappingStatusLabel('blocked')).toMatch(/bloqueado/i);
  });

  it('parsePreviewResponse accepts rows with sugestoes_estabelecimento', () => {
    const rows: PreviewCargaEnriquecida[] = [
      {
        nome: 'relatorio.csv',
        tipo_relatorio: 'atendimento_individual',
        competencia: '2026-05',
        esus_unidade: 'CAFI CENTRO',
        esus_equipe_nome: 'EQUIPE 9 EAP',
        esus_equipe_codigo: '0009',
        mapeamento_status: 'pending',
        ja_importado: false,
        sugestoes_estabelecimento: [
          { id: 42, codigo_externo: '7169698', nome: 'CAFI', score: 0.9 },
        ],
      },
    ];

    expect(parsePreviewResponse(rows)).toHaveLength(1);
    expect(hasEstabelecimentoSugestoes(rows[0]!)).toBe(true);
    expect(isPreviewCargaEnriquecida(rows[0])).toBe(true);
  });

  it('parsePreviewResponse filters invalid preview rows', () => {
    expect(parsePreviewResponse([{ nome: 123 }])).toHaveLength(0);
    expect(parsePreviewResponse(null)).toEqual([]);
  });

  it('buildConflitoTodasMessage describes Todas conflict for user', () => {
    const blocked: PreviewCargaEnriquecida = {
      nome: 'x.csv',
      tipo_relatorio: 'atendimento_individual',
      competencia: '2026-05',
      esus_unidade: 'CAFI',
      esus_equipe_nome: 'EQUIPE 9',
      esus_equipe_codigo: '0009',
      ja_importado: false,
      mapeamento_status: 'blocked',
      conflito_todas: { exists: true, cargas_ids: [1], requires_confirm: true },
    };

    expect(buildConflitoTodasMessage(blocked)).toMatch(/todas/i);
    expect(buildConflitoTodasMessage({ ...blocked, conflito_todas: undefined })).toBeNull();
  });

  it('preview label helpers prefer esus fields with legacy fallback', () => {
    const enriched: PreviewCargaEnriquecida = {
      nome: 'a.csv',
      tipo_relatorio: 'x',
      competencia: '2026-05',
      esus_unidade: 'ESUS UNIT',
      esus_equipe_nome: 'ESUS TEAM',
      esus_equipe_codigo: null,
      ja_importado: false,
    };

    expect(previewUnidadeLabel(enriched)).toBe('ESUS UNIT');
    expect(previewEquipeLabel({ ...enriched, esus_equipe_nome: '', equipe_nome: 'LEGACY' })).toBe('LEGACY');
  });

  it('isPreviewCargaEnriquecida rejects invalid rows', () => {
    expect(isPreviewCargaEnriquecida(null)).toBe(false);
    expect(isPreviewCargaEnriquecida({ nome: 1 })).toBe(false);
    expect(isPreviewCargaEnriquecida({ nome: 'x', mapeamento_status: 'invalid' })).toBe(false);
    expect(
      isPreviewCargaEnriquecida({
        nome: 'x',
        sugestoes_estabelecimento: [{ id: 'bad', codigo_externo: '1', nome: 'A' }],
      }),
    ).toBe(false);
  });

  it('buildConflitoTodasMessage handles incoming Todas blocked case', () => {
    const item: PreviewCargaEnriquecida = {
      nome: 'x.csv',
      tipo_relatorio: 'atendimento_individual',
      competencia: '2026-05',
      esus_unidade: 'CAFI',
      esus_equipe_nome: 'Todas',
      esus_equipe_codigo: null,
      ja_importado: false,
      conflito_todas: { exists: true, cargas_ids: [2], requires_confirm: false },
    };

    expect(buildConflitoTodasMessage(item)).toMatch(/bloqueada/i);
  });

  it('canEnableProcess respects pending mapping and planning role', () => {
    const pending: PreviewCargaEnriquecida = {
      nome: 'a.csv',
      tipo_relatorio: 'x',
      competencia: '2026-05',
      esus_unidade: 'U',
      esus_equipe_nome: 'E',
      esus_equipe_codigo: null,
      ja_importado: false,
      mapeamento_status: 'pending',
      sugestoes_estabelecimento: [{ id: 1, codigo_externo: '1', nome: 'A', score: 1 }],
    };
    const resolved: PreviewCargaEnriquecida = {
      ...pending,
      mapeamento_status: 'resolved',
      estabelecimento_id: 1,
    };

    const pendingDrafts = { 'a.csv': defaultDraftFromPreview(pending) };
    const resolvedDrafts = { 'a.csv': defaultDraftFromPreview(resolved) };

    expect(canEnableProcess([pending], pendingDrafts, true)).toBe(false);
    expect(canEnableProcess([resolved], resolvedDrafts, true)).toBe(true);
    expect(canEnableProcess([resolved], resolvedDrafts, false)).toBe(false);
    expect(isRowReadyForProcess(pending, pendingDrafts['a.csv']!)).toBe(false);
    expect(
      isRowReadyForProcess(pending, { ...pendingDrafts['a.csv']!, estabelecimento_id: 1 }),
    ).toBe(true);
  });

  it('buildResolucoesUpload and needsTodasConfirmation handle Todas confirm flag', () => {
    const row: PreviewCargaEnriquecida = {
      nome: 'a.csv',
      tipo_relatorio: 'x',
      competencia: '2026-05',
      esus_unidade: 'U',
      esus_equipe_nome: 'E',
      esus_equipe_codigo: null,
      ja_importado: false,
      mapeamento_status: 'blocked',
      estabelecimento_id: 5,
      equipe_id: 9,
      conflito_todas: { exists: true, cargas_ids: [1], requires_confirm: true },
    };
    const drafts = { 'a.csv': defaultDraftFromPreview(row) };

    expect(needsTodasConfirmation([row], drafts)).toBe(row);
    expect(buildResolucoesUpload([row], drafts)[0]?.confirmar_remocao_todas).toBeUndefined();
    expect(isRowReadyForProcess(row, drafts['a.csv']!)).toBe(true);

    const confirmed = {
      'a.csv': { ...drafts['a.csv']!, confirmar_remocao_todas: true },
    };
    expect(needsTodasConfirmation([row], confirmed)).toBeNull();
    expect(buildResolucoesUpload([row], confirmed)[0]?.confirmar_remocao_todas).toBe(true);
  });

  it('formatCadastroTargetLabel prefers resolved cadastro or suggestion', () => {
    const row: PreviewCargaEnriquecida = {
      nome: 'a.csv',
      tipo_relatorio: 'x',
      competencia: '2026-05',
      esus_unidade: 'U',
      esus_equipe_nome: 'E',
      esus_equipe_codigo: null,
      ja_importado: false,
      estabelecimento_id: 42,
      estabelecimento_codigo: '7169698',
      estabelecimento_nome: 'CAFI',
      sugestoes_estabelecimento: [{ id: 99, codigo_externo: '999', nome: 'Other', score: 0.5 }],
    };

    expect(formatCadastroTargetLabel(row)).toBe('7169698 · CAFI');
    expect(formatCadastroTargetLabel(row, { ...defaultDraftFromPreview(row), estabelecimento_id: 99 })).toBe(
      '999 · Other',
    );
  });

  it('notifyCargasUpdated dispatches browser event', async () => {
    const { notifyCargasUpdated, CARGAS_UPDATED_EVENT } = await import('./importacaoView');
    const handler = vi.fn();
    window.addEventListener(CARGAS_UPDATED_EVENT, handler);
    notifyCargasUpdated();
    expect(handler).toHaveBeenCalled();
    window.removeEventListener(CARGAS_UPDATED_EVENT, handler);
  });
});
