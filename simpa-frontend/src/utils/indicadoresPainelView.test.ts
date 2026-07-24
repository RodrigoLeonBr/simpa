import { describe, expect, it, vi } from 'vitest';
import { fetchPainelWidgets } from '../api/painelWidgets';
import type { PainelWidgetConfig } from '../types/painelWidgets';
import {
  fetchPainelWidgetsByPerfilLayout,
  formatDiscoverCatalogToast,
  formatPainelWidgetLayoutLabel,
  swapWidgetOrderIds,
} from './indicadoresPainelView';

vi.mock('../api/painelWidgets', () => ({
  fetchPainelWidgets: vi.fn(),
}));

function row(id: number): PainelWidgetConfig {
  return {
    id,
    slug: `w-${id}`,
    perfil: 'APS',
    layout: 'A',
    ordem: id,
    tipo: 'card',
    titulo: `W${id}`,
    subtitulo: null,
    formato: 'numero',
    metrica_id: 1,
    fonte_config: {},
    spark_metrica_id: null,
    spark_config: null,
    sql_preview: null,
    sql_override: null,
    spark_sql_override: null,
    delta_config: null,
    status: 'ativo',
  };
}

describe('formatDiscoverCatalogToast', () => {
  it('inclui detalhamento por fonte quando disponível', () => {
    expect(
      formatDiscoverCatalogToast({
        inserted: 4,
        updated: 6,
        sources: {
          esus_raw: { inserted: 1, updated: 2 },
          sia: { inserted: 2, updated: 3 },
          sih: { inserted: 1, updated: 1 },
        },
      }),
    ).toBe('Catálogo atualizado — 4 inseridas, 6 atualizadas (e-SUS: 1/2 · SIA: 2/3 · SIHD: 1/1)');
  });
});

describe('formatPainelWidgetLayoutLabel', () => {
  it('retorna rótulo amigável para A, B e C', () => {
    expect(formatPainelWidgetLayoutLabel('A')).toBe('A · Cards');
    expect(formatPainelWidgetLayoutLabel('B')).toBe('B · Foco');
    expect(formatPainelWidgetLayoutLabel('C')).toBe('C · Tabela');
  });
});

describe('fetchPainelWidgetsByPerfilLayout', () => {
  it('consulta API com perfil e layout informados', async () => {
    vi.mocked(fetchPainelWidgets).mockResolvedValue([
      { id: 2, ordem: 2 },
      { id: 1, ordem: 1 },
    ] as PainelWidgetConfig[]);

    const rows = await fetchPainelWidgetsByPerfilLayout('Hospitalar', 'C');

    expect(fetchPainelWidgets).toHaveBeenCalledWith({
      perfil: 'Hospitalar',
      layout: 'C',
      includeInactive: true,
    });
    expect(rows.map((row) => row.id)).toEqual([1, 2]);
  });
});

describe('swapWidgetOrderIds', () => {
  it('troca ids ao mover para baixo', () => {
    const rows = [row(1), row(2), row(3)];
    expect(swapWidgetOrderIds(rows, 0, 'down')).toEqual([2, 1, 3]);
  });

  it('troca ids ao mover para cima', () => {
    const rows = [row(1), row(2), row(3)];
    expect(swapWidgetOrderIds(rows, 2, 'up')).toEqual([1, 3, 2]);
  });

  it('retorna ordem original quando índice inválido', () => {
    const rows = [row(1), row(2)];
    expect(swapWidgetOrderIds(rows, 0, 'up')).toEqual([1, 2]);
    expect(swapWidgetOrderIds(rows, 1, 'down')).toEqual([1, 2]);
  });
});
