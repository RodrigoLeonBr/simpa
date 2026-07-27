import { describe, expect, it } from 'vitest';
import { buildRelatorioCsv } from './exportRelatorio';
import type { BenchmarkRow, RelatSinteseRow } from './comparativoView';

const meta = { cod: 'C1', nomeCurto: 'Consultas', competencia: '2026-07' };

const rows: BenchmarkRow[] = [
  {
    rank: '01',
    nome: 'UBS Centro; Norte', // separador embutido -> deve virar aspas
    tipo: 'APS',
    execText: '85%',
    widthPct: 90,
    color: '#000',
    diffText: '+3,2 p.p.',
    diffColor: '#0a0',
  },
];

const sintese: RelatSinteseRow[] = [{ label: 'Média municipal', value: '80%', color: '#00f' }];

describe('buildRelatorioCsv', () => {
  it('escapa campo com separador em aspas e monta seções', () => {
    const csv = buildRelatorioCsv(meta, rows, sintese);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Relatório comparativo entre unidades');
    expect(lines[1]).toBe('Indicador;C1 Consultas');
    expect(lines[4]).toBe('#;Unidade;Tipo;Atingimento;vs. média');
    // nome com ';' vem entre aspas, demais campos crus
    expect(lines[5]).toBe('01;"UBS Centro; Norte";APS;85%;+3,2 p.p.');
    expect(csv).toContain('Síntese municipal');
    expect(csv).toContain('Média municipal;80%');
  });
});
