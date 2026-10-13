import { describe, expect, it } from 'vitest';
import type { PreviewCargaEnriquecida } from '../../types/importacao';
import type { ResolucaoDraft } from './types';
import {
  buildMappingStatusLabel,
  isPreviewCargaEnriquecida,
  parsePreviewResponse,
  hasEstabelecimentoSugestoes,
  buildConflitoTodasMessage,
  defaultDraftFromPreview,
  hasPendingMapping,
  isRowReadyForProcess,
  canEnableProcess,
  buildResolucoesUpload,
  needsTodasConfirmation,
  isCsvFile,
  filterCsvFiles,
  buildCargaStatus,
  countPendingCargas,
} from './previewHelpers';

const row = (over: Partial<PreviewCargaEnriquecida> = {}): PreviewCargaEnriquecida =>
  ({ nome: 'carga.csv', ...over } as PreviewCargaEnriquecida);
const file = (name: string): File => ({ name } as File);

describe('buildMappingStatusLabel', () => {
  it('maps known status and falls back', () => {
    expect(buildMappingStatusLabel('resolved')).toBe('Vinculado');
    expect(buildMappingStatusLabel('xpto' as never)).toBe('Status desconhecido');
  });
});

describe('isPreviewCargaEnriquecida / parsePreviewResponse', () => {
  it('rejects non-objects and bad shapes', () => {
    expect(isPreviewCargaEnriquecida(null)).toBe(false);
    expect(isPreviewCargaEnriquecida(42)).toBe(false);
    expect(isPreviewCargaEnriquecida({})).toBe(false); // nome não-string
    expect(isPreviewCargaEnriquecida({ nome: 'a', mapeamento_status: 'nope' })).toBe(false);
    expect(
      isPreviewCargaEnriquecida({ nome: 'a', sugestoes_estabelecimento: 'x' }),
    ).toBe(false);
    expect(
      isPreviewCargaEnriquecida({ nome: 'a', sugestoes_estabelecimento: [{ id: 'x', codigo_externo: 1, nome: 2 }] }),
    ).toBe(false);
  });

  it('accepts valid rows and parsePreviewResponse filters', () => {
    const ok = { nome: 'a', mapeamento_status: 'resolved', sugestoes_estabelecimento: [{ id: 1, codigo_externo: 'c', nome: 'n' }] };
    expect(isPreviewCargaEnriquecida(ok)).toBe(true);
    expect(parsePreviewResponse('nope')).toEqual([]);
    expect(parsePreviewResponse([ok, 5, {}])).toHaveLength(1);
  });
});

describe('sugestoes + conflito messages', () => {
  it('hasEstabelecimentoSugestoes true only with non-empty array', () => {
    expect(hasEstabelecimentoSugestoes(row())).toBe(false);
    expect(hasEstabelecimentoSugestoes(row({ sugestoes_estabelecimento: [] }))).toBe(false);
    expect(hasEstabelecimentoSugestoes(row({ sugestoes_estabelecimento: [{ id: 1, codigo_externo: 'c', nome: 'n' }] }))).toBe(true);
  });

  it('buildConflitoTodasMessage covers all three outcomes', () => {
    expect(buildConflitoTodasMessage(row())).toBeNull();
    expect(buildConflitoTodasMessage(row({ conflito_todas: { exists: true, requires_confirm: true } }))).toMatch(/Confirme a remoção/);
    expect(buildConflitoTodasMessage(row({ conflito_todas: { exists: true, requires_confirm: false } }))).toMatch(/bloqueada/);
  });
});

describe('draft + readiness', () => {
  it('defaultDraftFromPreview uses ids or null', () => {
    expect(defaultDraftFromPreview(row())).toEqual({ estabelecimento_id: null, equipe_id: null, salvar_mapeamento: false, confirmar_remocao_todas: false });
    expect(defaultDraftFromPreview(row({ estabelecimento_id: 7, equipe_id: 3 })).estabelecimento_id).toBe(7);
  });

  it('hasPendingMapping ignores errored rows', () => {
    expect(hasPendingMapping([row({ mapeamento_status: 'pending' })])).toBe(true);
    expect(hasPendingMapping([row({ mapeamento_status: 'pending', error: 'x' })])).toBe(false);
  });

  it('isRowReadyForProcess across error/blocked/pending/resolved', () => {
    const draft: ResolucaoDraft = { estabelecimento_id: null, equipe_id: null, salvar_mapeamento: false, confirmar_remocao_todas: false };
    expect(isRowReadyForProcess(row({ error: 'x' }), draft)).toBe(false);
    // blocked sem requires_confirm → false
    expect(isRowReadyForProcess(row({ mapeamento_status: 'blocked' }), draft)).toBe(false);
    // blocked com requires_confirm → precisa estab > 0
    expect(isRowReadyForProcess(row({ mapeamento_status: 'blocked', conflito_todas: { exists: true, requires_confirm: true } }), { ...draft, estabelecimento_id: 5 })).toBe(true);
    // pending sem estab → false; com estab → true
    expect(isRowReadyForProcess(row({ mapeamento_status: 'pending' }), draft)).toBe(false);
    expect(isRowReadyForProcess(row({ mapeamento_status: 'pending', estabelecimento_id: 9 }), draft)).toBe(true);
    // resolved com estab → true
    expect(isRowReadyForProcess(row({ mapeamento_status: 'resolved', estabelecimento_id: 2 }), draft)).toBe(true);
  });
});

describe('canEnableProcess / buildResolucoesUpload / needsTodasConfirmation', () => {
  it('canEnableProcess gated by staff + actionable rows all ready', () => {
    const ready = row({ nome: 'r', mapeamento_status: 'resolved', estabelecimento_id: 1 });
    expect(canEnableProcess([ready], {}, false)).toBe(false); // não-staff
    expect(canEnableProcess([row({ error: 'x' })], {}, true)).toBe(false); // nenhum acionável
    expect(canEnableProcess([ready], {}, true)).toBe(true);
    // um acionável não-pronto (pending sem estabelecimento) → false
    const pending = row({ nome: 'p', mapeamento_status: 'pending' });
    expect(canEnableProcess([ready, pending], {}, true)).toBe(false);
  });

  it('buildResolucoesUpload drops errors, applies drafts/fallbacks', () => {
    const rows = [row({ nome: 'a', estabelecimento_id: 1, equipe_id: 2 }), row({ nome: 'b', error: 'x' })];
    const out = buildResolucoesUpload(rows, { a: { estabelecimento_id: 5, equipe_id: null, salvar_mapeamento: true, confirmar_remocao_todas: true } });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ arquivo: 'a', estabelecimento_id: 5, equipe_id: 2, salvar_mapeamento: true, confirmar_remocao_todas: true });
  });

  it('needsTodasConfirmation returns first unconfirmed conflicting row, else null', () => {
    const conflict = row({ nome: 'c', conflito_todas: { exists: true, requires_confirm: true } });
    expect(needsTodasConfirmation([row()], {})).toBeNull();
    expect(needsTodasConfirmation([conflict], {})?.nome).toBe('c');
    expect(needsTodasConfirmation([conflict], { c: defaultDraftFromPreview(row({ conflito_todas: { exists: true, requires_confirm: true } })) })).not.toBeNull();
    expect(needsTodasConfirmation([conflict], { c: { estabelecimento_id: null, equipe_id: null, salvar_mapeamento: false, confirmar_remocao_todas: true } })).toBeNull();
  });
});

describe('csv + carga status', () => {
  it('isCsvFile / filterCsvFiles', () => {
    expect(isCsvFile(file('A.CSV'))).toBe(true);
    expect(isCsvFile(file('a.xlsx'))).toBe(false);
    expect(filterCsvFiles([file('a.csv'), file('b.txt')]).map((f) => f.name)).toEqual(['a.csv']);
  });

  it('buildCargaStatus três estados + countPendingCargas', () => {
    expect(buildCargaStatus(null, null).label).toBe('Processando');
    expect(buildCargaStatus(10, 3).label).toBe('Parcial');
    expect(buildCargaStatus(10, 0).label).toBe('OK');
    expect(countPendingCargas([{ registros_identificados: null }, { registros_identificados: 5 }] as never)).toBe(1);
  });
});
