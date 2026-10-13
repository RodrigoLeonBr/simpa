import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VacinaEsquemaPage } from './VacinaEsquemaPage';
import * as api from '../../api/vacina';

vi.mock('../../api/vacina');

const esquema = { id: 1, imuno_codigo: '85', imuno_nome: 'BCG', grupo_id: 1, grupo_nome: 'Crianças', num_doses: 1 };
const renderPage = () => render(<MemoryRouter><VacinaEsquemaPage /></MemoryRouter>);

beforeEach(() => {
  vi.mocked(api.fetchEsquema).mockResolvedValue([esquema as api.Esquema]);
  vi.mocked(api.fetchGrupos).mockResolvedValue([{ id: 1, nome: 'Crianças' } as api.VacinaGrupo]);
  vi.mocked(api.fetchImunobiologicos).mockResolvedValue([{ imuno_codigo: '85', imuno_nome: 'BCG' } as api.Imunobiologico]);
  vi.mocked(api.upsertEsquema).mockResolvedValue({} as never);
  vi.mocked(api.deleteEsquema).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('VacinaEsquemaPage', () => {
  it('lista esquemas', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('BCG')).toBeInTheDocument());
  });

  it('exclui esquema', async () => {
    renderPage();
    await screen.findByText('BCG');
    fireEvent.click(screen.getByText('Excluir'));
    await waitFor(() => expect(api.deleteEsquema).toHaveBeenCalledWith(1));
  });

  it('upsert válido chama API', async () => {
    renderPage();
    await screen.findByText('BCG');
    fireEvent.change(screen.getByLabelText('Imunobiológico'), { target: { value: '85' } });
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Nº de doses'), { target: { value: '3' } });
    fireEvent.submit(screen.getByText('Salvar').closest('form')!);
    await waitFor(() => expect(api.upsertEsquema).toHaveBeenCalledWith({ imuno_codigo: '85', grupo_id: 1, num_doses: 3 }));
  });

  it('upsert inválido (campos vazios) não chama API', async () => {
    renderPage();
    await screen.findByText('BCG');
    fireEvent.submit(screen.getByText('Salvar').closest('form')!);
    await Promise.resolve();
    expect(api.upsertEsquema).not.toHaveBeenCalled();
  });

  it('mostra vazio quando não há esquemas', async () => {
    vi.mocked(api.fetchEsquema).mockResolvedValueOnce([]);
    renderPage();
    await waitFor(() => expect(screen.getByText('Nenhum esquema cadastrado.')).toBeInTheDocument());
  });

  it('erro ao salvar esquema é exibido', async () => {
    vi.mocked(api.upsertEsquema).mockRejectedValueOnce(new Error('doses inválidas'));
    renderPage();
    await screen.findByText('BCG');
    fireEvent.change(screen.getByLabelText('Imunobiológico'), { target: { value: '85' } });
    fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Nº de doses'), { target: { value: '2' } });
    fireEvent.submit(screen.getByText('Salvar').closest('form')!);
    await waitFor(() => expect(screen.getByText('doses inválidas')).toBeInTheDocument());
  });

  it('erro de carga é exibido', async () => {
    vi.mocked(api.fetchEsquema).mockRejectedValueOnce(new Error('falha'));
    renderPage();
    await waitFor(() => expect(screen.getByText('falha')).toBeInTheDocument());
  });

  it('erro ao excluir é exibido', async () => {
    vi.mocked(api.deleteEsquema).mockRejectedValueOnce(new Error('em uso'));
    renderPage();
    await screen.findByText('BCG');
    fireEvent.click(screen.getByText('Excluir'));
    await waitFor(() => expect(screen.getByText('em uso')).toBeInTheDocument());
  });
});
