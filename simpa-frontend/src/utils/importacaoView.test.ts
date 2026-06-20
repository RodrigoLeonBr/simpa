import { describe, expect, it } from 'vitest';
import type { CargaEsus } from '../types/contrato';
import {
  buildCargaStatus,
  countPendingCargas,
  filterCsvFiles,
  isCsvFile,
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
});
