import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VacinaFaixaGrupoPage } from './VacinaFaixaGrupoPage';
import * as api from '../../api/vacina';

vi.mock('../../api/vacina');

const renderPage = () => render(<MemoryRouter><VacinaFaixaGrupoPage /></MemoryRouter>);

beforeEach(() => {
  vi.mocked(api.fetchFaixaGrupo).mockResolvedValue([{ faixa_nies: '< 01 ano', grupo_id: null } as api.FaixaGrupo]);
  vi.mocked(api.fetchGrupos).mockResolvedValue([{ id: 1, nome: 'Crianças' } as api.VacinaGrupo]);
  vi.mocked(api.setFaixaGrupo).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('VacinaFaixaGrupoPage', () => {
  it('lista faixas', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('< 01 ano')).toBeInTheDocument());
  });

  it('seleciona grupo → setFaixaGrupo com número', async () => {
    renderPage();
    await screen.findByText('< 01 ano');
    fireEvent.change(screen.getByLabelText('Grupo para < 01 ano'), { target: { value: '1' } });
    await waitFor(() => expect(api.setFaixaGrupo).toHaveBeenCalledWith('< 01 ano', 1));
  });

  it('limpa grupo → setFaixaGrupo com null', async () => {
    vi.mocked(api.fetchFaixaGrupo).mockResolvedValue([{ faixa_nies: '< 01 ano', grupo_id: 1 } as api.FaixaGrupo]);
    renderPage();
    await screen.findByText('< 01 ano');
    fireEvent.change(screen.getByLabelText('Grupo para < 01 ano'), { target: { value: '' } });
    await waitFor(() => expect(api.setFaixaGrupo).toHaveBeenCalledWith('< 01 ano', null));
  });

  it('erro de carga', async () => {
    vi.mocked(api.fetchFaixaGrupo).mockRejectedValueOnce(new Error('falha faixa'));
    renderPage();
    await waitFor(() => expect(screen.getByText('falha faixa')).toBeInTheDocument());
  });

  it('erro ao salvar de-para', async () => {
    vi.mocked(api.setFaixaGrupo).mockRejectedValueOnce(new Error('conflito'));
    renderPage();
    await screen.findByText('< 01 ano');
    fireEvent.change(screen.getByLabelText('Grupo para < 01 ano'), { target: { value: '1' } });
    await waitFor(() => expect(screen.getByText('conflito')).toBeInTheDocument());
  });
});
