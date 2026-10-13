import { describe, expect, it } from 'vitest';
import type { ContratoDashboard } from '../../types/contrato';
import { buildPainelKpis } from './kpiView';

describe('buildPainelKpis', () => {
  it('builds 6 kpis, computes delta from previous historico and metas label', () => {
    const data = {
      kpis_gerais: { total_atendimentos_aps: 500, atendimentos_odonto: 80, total_participantes_coletivos: 30 },
      modulos: {
        atencao_primaria_esus: {
          historico_mensal: [
            { competencia: '2026-01', atendimentos: 400, procedimentos: 60 },
            { competencia: '2026-02', atendimentos: 500, procedimentos: 80 },
          ],
        },
        financiamento_metas: { indicadores: [{ valor: 9, meta: 5 }, { valor: 1, meta: 5 }] },
      },
    } as unknown as ContratoDashboard;

    const kpis = buildPainelKpis(data);
    expect(kpis).toHaveLength(6);
    const atend = kpis.find((k) => k.id === 'atendimentos')!;
    expect(atend.raw).toBe(500);
    expect(atend.sparkSeries).toEqual([400, 500]);
    expect(kpis.find((k) => k.id === 'metas')!.value).toBe('1 / 2');
  });

  it('null kpis and no historico → EM_DASH metas, empty sparks', () => {
    const kpis = buildPainelKpis({ modulos: {} } as unknown as ContratoDashboard);
    expect(kpis.find((k) => k.id === 'metas')!.value).toBe('—');
    expect(kpis.find((k) => k.id === 'atendimentos')!.sparkSeries).toEqual([]);
    expect(kpis.find((k) => k.id === 'atendimentos')!.isNull).toBe(true);
  });
});
