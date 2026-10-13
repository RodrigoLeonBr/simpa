import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VacinaPopulacaoPage } from './VacinaPopulacaoPage';
import * as api from '../../api/vacina';

vi.mock('../../api/vacina');

const pop = { id: 1, grupo_id: 1, grupo_nome: 'Crianças', ano: 2026, populacao: 1234 };
const renderPage = () => render(<MemoryRouter><VacinaPopulacaoPage /></MemoryRouter>);

beforeEach(() => {
  vi.mocked(api.fetchPopulacao).mockResolvedValue([pop as api.PopulacaoAlvo]);
  vi.mocked(api.fetchGrupos).mockResolvedValue([{ id: 1, nome: 'Crianças' } as api.VacinaGrupo]);
  vi.mocked(api.upsertPopulacao).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('VacinaPopulacaoPage', () => {
  it('lista população formatada', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('1.234')).toBeInTheDocument());
  });

  it('troca de ano recarrega com o novo ano', async () => {
    renderPage();
    await screen.findByText('1.234');
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '2025' } });
    await waitFor(() => expect(api.fetchPopulacao).toHaveBeenLastCalledWith(2025));
  });

  it('upsert válido chama API com ano atual', async () => {
    renderPage();
    await screen.findByText('1.234');
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('População'), { target: { value: '500' } });
    fireEvent.submit(screen.getByText('Salvar').closest('form')!);
    await waitFor(() => expect(api.upsertPopulacao).toHaveBeenCalledWith({ ano: 2026, grupo_id: 1, populacao: 500 }));
  });

  it('upsert inválido não chama API', async () => {
    renderPage();
    await screen.findByText('1.234');
    fireEvent.submit(screen.getByText('Salvar').closest('form')!);
    await Promise.resolve();
    expect(api.upsertPopulacao).not.toHaveBeenCalled();
  });

  it('mostra vazio quando não há registros', async () => {
    vi.mocked(api.fetchPopulacao).mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => expect(screen.getByText(/Nenhum registro para 2026/)).toBeInTheDocument());
  });

  it('erro ao salvar população é exibido', async () => {
    vi.mocked(api.upsertPopulacao).mockRejectedValueOnce(new Error('população inválida'));
    renderPage();
    await screen.findByText('1.234');
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('População'), { target: { value: '10' } });
    fireEvent.submit(screen.getByText('Salvar').closest('form')!);
    await waitFor(() => expect(screen.getByText('população inválida')).toBeInTheDocument());
  });

  it('erro de carga é exibido', async () => {
    vi.mocked(api.fetchPopulacao).mockRejectedValueOnce(new Error('sem dados'));
    renderPage();
    await waitFor(() => expect(screen.getByText('sem dados')).toBeInTheDocument());
  });
});
