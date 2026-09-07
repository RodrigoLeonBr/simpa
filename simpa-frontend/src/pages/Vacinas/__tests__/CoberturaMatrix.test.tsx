import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CoberturaMatrix, coberturaColor } from '../CoberturaMatrix';
import type { CoberturaRow } from '../../../types/vacina';

const rows: CoberturaRow[] = [
  { imuno_codigo: '93', imuno_nome: 'HPV', grupo_id: 1, grupo_nome: 'Adolescente', doses: 200, pop_alvo: 100, num_doses: 2, denominador: 200, cobertura_pct: 100 },
  { imuno_codigo: '9', imuno_nome: 'Hep B', grupo_id: 1, grupo_nome: 'Adolescente', doses: 50, pop_alvo: 0, num_doses: 3, denominador: 0, cobertura_pct: null },
];

describe('coberturaColor', () => {
  it('faixas de heatmap', () => {
    expect(coberturaColor(40)).toMatch(/red/);
    expect(coberturaColor(70)).toMatch(/amber|yellow/);
    expect(coberturaColor(96)).toMatch(/green/);
    expect(coberturaColor(null)).toMatch(/gray|slate/);
  });
});

describe('CoberturaMatrix', () => {
  it('renderiza vacina e % e trata null como —', () => {
    render(<CoberturaMatrix rows={rows} />);
    expect(screen.getByText('HPV')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
