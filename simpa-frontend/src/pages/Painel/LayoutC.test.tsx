import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContratoDashboard, Unidade } from '../../types/contrato';
import mockDb from '../../../mock/db.json';
import { LayoutC } from './LayoutC';

vi.mock('echarts/core', () => ({
  use: vi.fn(),
  init: vi.fn(() => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('LayoutC', () => {
  it('renders dense unit table', () => {
    render(
      <LayoutC
        data={mockDb.planejamento[0] as ContratoDashboard}
        unidades={mockDb.unidades as Unidade[]}
      />,
    );

    expect(screen.getByTestId('layout-c')).toBeInTheDocument();
    expect(screen.getByText('Desempenho por unidade · competência 2026-05')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
  });
});
