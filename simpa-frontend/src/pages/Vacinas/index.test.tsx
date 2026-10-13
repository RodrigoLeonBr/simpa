import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fetchPainelLayout } from '../../api/painelWidgets';
import { MemoryRouter } from 'react-router-dom';
import VacinasPage from './index';

vi.mock('../../api/vacina', () => ({
  fetchCobertura: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../api/painelWidgets', () => ({
  fetchPainelLayout: vi.fn().mockResolvedValue({
    perfil: 'Vacinas', layout: 'A', periodo: '2026-12', competencia: '2026-12',
    widgets: [{ slug: 'c1', ordem: 1, tipo: 'card', titulo: 'Doses', subtitulo: null, formato: 'numero', value: 10, valueLabel: '10', isNull: false }],
  }),
}));
vi.mock('../../components/painel/DynamicWidgetGrid', () => ({
  DynamicWidgetGrid: () => <div data-testid="vacinas-indicadores-grid" />,
}));

describe('VacinasPage — indicadores', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza a seção de indicadores quando há widgets', async () => {
    render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('vacinas-indicadores-grid')).toBeInTheDocument());
  });

  it('mostra link para gerenciar indicadores', () => {
    render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    const link = screen.getByTestId('vacinas-gerenciar-indicadores');
    expect(link).toHaveAttribute('href', expect.stringContaining('perfil=Vacinas'));
  });

  it('oculta a seção quando não há widgets', async () => {
    vi.mocked(fetchPainelLayout).mockResolvedValueOnce({
      perfil: 'Vacinas', layout: 'A', periodo: '2026-12', competencia: '2026-12', widgets: [],
    });
    render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('vacinas-gerenciar-indicadores')).toBeInTheDocument());
    expect(screen.queryByTestId('vacinas-indicadores')).toBeNull();
  });
});
