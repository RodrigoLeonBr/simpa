import { describe, expect, it } from 'vitest';
import type { ContratoDashboard, Unidade } from '../types/contrato';
import mockDb from '../../mock/db.json';
import {
  buildModuleStatuses,
  buildPainelKpis,
  buildRanking,
  buildUnitTable,
  getPainelCatalogStatus,
  isPainelCatalogReady,
  needsConsolidatedDashboard,
  PAINEL_KPI_CATALOGS,
  resolvePainelViewContext,
} from './dashboardView';

describe('dashboardView', () => {
  const data = mockDb.planejamento[0] as ContratoDashboard;

  it('getPainelCatalogStatus returns ready for APS', () => {
    expect(getPainelCatalogStatus('APS')).toBe('ready');
    expect(getPainelCatalogStatus('APS', 'B')).toBe('ready');
  });

  it('getPainelCatalogStatus returns pending for MAC and other non-APS perfis', () => {
    expect(getPainelCatalogStatus('MAC')).toBe('pending');
    expect(getPainelCatalogStatus('Hospitalar')).toBe('pending');
    expect(getPainelCatalogStatus('Misto', 'C')).toBe('ready');
  });

  it('PAINEL_KPI_CATALOGS marks APS and Hospitalar A as ready', () => {
    expect(PAINEL_KPI_CATALOGS.APS).toEqual({ A: 'ready', B: 'ready', C: 'ready' });
    expect(PAINEL_KPI_CATALOGS.MAC.A).toBe('ready');
    expect(PAINEL_KPI_CATALOGS.Hospitalar).toEqual({ A: 'ready', B: 'ready', C: 'ready' });
    expect(isPainelCatalogReady('Hospitalar')).toBe(true);
    expect(isPainelCatalogReady('Hospitalar', 'B')).toBe(true);
    expect(isPainelCatalogReady('Hospitalar', 'C')).toBe(true);
  });

  it('needsConsolidatedDashboard is false for Layout A dinâmico (APS/MAC/Hospitalar)', () => {
    expect(needsConsolidatedDashboard('APS', 'A')).toBe(false);
    expect(needsConsolidatedDashboard('MAC', 'A')).toBe(false);
    expect(needsConsolidatedDashboard('Hospitalar', 'A')).toBe(false);
    expect(needsConsolidatedDashboard('APS', 'B')).toBe(true);
    expect(needsConsolidatedDashboard('MAC', 'B')).toBe(false);
    expect(needsConsolidatedDashboard('Hospitalar', 'B')).toBe(false);
  });

  it('resolvePainelViewContext combines perfil, layout and catalog status', () => {
    expect(resolvePainelViewContext('APS', 'A')).toEqual({
      perfil: 'APS',
      layout: 'A',
      catalogStatus: 'ready',
    });
    expect(resolvePainelViewContext('MAC', 'B').catalogStatus).toBe('pending');
  });

  it('builds six KPI cards', () => {
    const kpis = buildPainelKpis(data);
    expect(kpis).toHaveLength(6);
    expect(kpis[0]?.label).toBe('Atendimentos individuais');
  });

  it('marks unavailable KPIs with em dash', () => {
    const kpis = buildPainelKpis(data);
    expect(kpis.find((item) => item.id === 'cobertura')?.value).toBe('—');
    expect(kpis.find((item) => item.id === 'cobertura')?.isNull).toBe(true);
  });

  it('builds module status badges for SIA and SIHD', () => {
    const statuses = buildModuleStatuses(data);
    expect(statuses).toHaveLength(2);
    expect(statuses[0]?.id).toBe('sia');
    expect(statuses[1]?.id).toBe('sihd');
  });

  it('builds ranking and unit table rows from unidades', () => {
    const unidades = mockDb.unidades as Unidade[];
    const ranking = buildRanking(data, unidades);
    const rows = buildUnitTable(data, unidades);

    expect(ranking.length).toBeGreaterThan(0);
    expect(rows.length).toBe(unidades.length);
    expect(rows[0]?.atendimentos).toBe('540');
  });

  it('unit table uses producao_por_unidade for atend/odonto in municipal aggregate', () => {
    const unidades = mockDb.unidades as Unidade[];
    const u0 = unidades[0]!;
    const u1 = unidades[1]!;
    const municipal = {
      ...data,
      filtros_ativos: { unidade: '', equipe: '' },
      modulos: {
        ...data.modulos,
        atencao_primaria_esus: {
          ...data.modulos.atencao_primaria_esus,
          producao_por_unidade: [
            { unidade: u0.nome, estabelecimento_id: u0.id, atendimentos: 111, odonto: 22 },
            { unidade: u1.nome, estabelecimento_id: u1.id, atendimentos: 333, odonto: 44 },
          ],
        },
      },
    } as unknown as ContratoDashboard;

    const rows = buildUnitTable(municipal, unidades);
    const r0 = rows.find((r) => r.nome === u0.nome);
    const r1 = rows.find((r) => r.nome === u1.nome);
    expect(r0?.atendimentos).toBe('111');
    expect(r0?.odonto).toBe('22');
    expect(r1?.atendimentos).toBe('333');
    expect(r1?.odonto).toBe('44');
  });

  it('maps unavailable SIA status to red tone', () => {
    const unavailable = {
      ...data,
      modulos: {
        ...data.modulos,
        ambulatorial_sia: { ...data.modulos.ambulatorial_sia, status_conexao: 'MySQL_XAMPP_UNAVAILABLE' },
      },
    };

    expect(buildModuleStatuses(unavailable)[0]?.tone).toBe('red');
  });

  it('handles consolidated payload without legacy financiamento_metas.indicadores', () => {
    const consolidated = {
      ...data,
      kpis_gerais: {
        total_atendimentos_aps: 540,
        atendimentos_odonto: 209,
        total_participantes_coletivos: 810,
        total_procedimentos_ambulatoriais: null,
      },
      modulos: {
        atencao_primaria_esus: {},
        ambulatorial_sia: { status_conexao: 'PENDING', procedimentos_especializados: [] },
        hospitalar_sihd: { status_importacao: 'PENDING_AIH_FILE', internacoes_por_capitulo_cid: [] },
        financiamento_metas: { componente_qualidade_aps: [], igm_sus_paulista: [] },
      },
    } as unknown as ContratoDashboard;

    expect(() => buildPainelKpis(consolidated)).not.toThrow();
    expect(buildPainelKpis(consolidated).find((item) => item.id === 'metas')?.value).toBe('—');
    expect(buildModuleStatuses(consolidated)).toHaveLength(2);
  });

  it('handles null financiamento_metas from empty database', () => {
    const emptyDb = {
      ...data,
      modulos: {
        ...data.modulos,
        financiamento_metas: null,
      },
    } as unknown as ContratoDashboard;

    expect(() => buildPainelKpis(emptyDb)).not.toThrow();
    expect(buildPainelKpis(emptyDb).find((item) => item.id === 'metas')?.value).toBe('—');
  });

  it('does not compare coletivas delta against unrelated historico field', () => {
    const coletivasKpi = buildPainelKpis(data).find((item) => item.id === 'coletivas');
    expect(coletivasKpi?.delta.label).toBe('—');
    expect(coletivasKpi?.sparkSeries).toEqual([]);
  });
});
