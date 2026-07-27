import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

const columns = [
  { key: 'tipo_relatorio', label: 'Relatório' },
  { key: 'descricao_esus', label: 'Descrição e-SUS' },
  { key: 'codigo_sigtap', label: 'SIGTAP' },
];

describe('toCsv', () => {
  it('monta header + linhas, escapa separador/nulos', () => {
    const rows = [
      { tipo_relatorio: 'procedimentos_individualizados', descricao_esus: 'Sutura; simples', codigo_sigtap: '0401010058' },
      { tipo_relatorio: 'atendimento_domiciliar', descricao_esus: 'Enema', codigo_sigtap: null },
    ];
    const lines = toCsv(columns, rows).split('\r\n');

    expect(lines[0]).toBe('Relatório;Descrição e-SUS;SIGTAP');
    // campo com ';' vem entre aspas
    expect(lines[1]).toBe('procedimentos_individualizados;"Sutura; simples";0401010058');
    // null vira vazio
    expect(lines[2]).toBe('atendimento_domiciliar;Enema;');
  });
});
