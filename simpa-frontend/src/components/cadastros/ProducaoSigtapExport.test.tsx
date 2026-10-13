import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProducaoSigtapExport } from './ProducaoSigtapExport';
import * as cadastros from '../../api/cadastros';
import * as csv from '../../utils/csv';

vi.mock('../../api/cadastros');
vi.mock('../../utils/csv', async () => {
  const actual = await vi.importActual<typeof import('../../utils/csv')>('../../utils/csv');
  return { ...actual, downloadCsv: vi.fn() };
});

beforeEach(() => {
  vi.mocked(cadastros.fetchProducaoSigtapCompetencias).mockResolvedValue(['2026-02', '2026-01']);
  vi.mocked(cadastros.fetchProducaoSigtap).mockResolvedValue([{ competencia: '2026-02', cnes: '1', quantidade: 5 }] as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('ProducaoSigtapExport', () => {
  it('carrega competências e seleciona a primeira', async () => {
    render(<ProducaoSigtapExport />);
    await waitFor(() => expect((screen.getByLabelText('Competência') as HTMLSelectElement).value).toBe('2026-02'));
  });

  it('exporta CSV e mostra toast de sucesso', async () => {
    render(<ProducaoSigtapExport />);
    await waitFor(() => expect(screen.getByLabelText('Competência')).toBeInTheDocument());
    fireEvent.click(screen.getByText('⤓ Exportar produção'));
    await waitFor(() => expect(csv.downloadCsv).toHaveBeenCalled());
    expect(screen.getByText(/Exportando 1 linhas/)).toBeInTheDocument();
  });

  it('toast quando não há linhas', async () => {
    vi.mocked(cadastros.fetchProducaoSigtap).mockResolvedValueOnce([] as never);
    render(<ProducaoSigtapExport />);
    await waitFor(() => expect(screen.getByLabelText('Competência')).toBeInTheDocument());
    fireEvent.click(screen.getByText('⤓ Exportar produção'));
    await waitFor(() => expect(screen.getByText(/Sem produção com de-para/)).toBeInTheDocument());
    expect(csv.downloadCsv).not.toHaveBeenCalled();
  });

  it('toast de falha quando a API rejeita', async () => {
    vi.mocked(cadastros.fetchProducaoSigtap).mockRejectedValueOnce(new Error('timeout'));
    render(<ProducaoSigtapExport />);
    await waitFor(() => expect(screen.getByLabelText('Competência')).toBeInTheDocument());
    fireEvent.click(screen.getByText('⤓ Exportar produção'));
    await waitFor(() => expect(screen.getByText('timeout')).toBeInTheDocument());
  });

  it('sem competências → select desabilitado com placeholder', async () => {
    vi.mocked(cadastros.fetchProducaoSigtapCompetencias).mockResolvedValueOnce([]);
    render(<ProducaoSigtapExport />);
    await waitFor(() => expect(screen.getByText('Sem produção importada')).toBeInTheDocument());
    expect(screen.getByLabelText('Competência')).toBeDisabled();
  });
});
