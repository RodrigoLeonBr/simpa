import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VacinaGruposPage } from './VacinaGruposPage';
import * as api from '../../api/vacina';

vi.mock('../../api/vacina');

const grupo = { id: 1, nome: 'Crianças', slug: 'criancas', ordem: 1, ativo: true };

const renderPage = () => render(<MemoryRouter><VacinaGruposPage /></MemoryRouter>);

beforeEach(() => {
  vi.mocked(api.fetchGrupos).mockResolvedValue([grupo as api.VacinaGrupo]);
  vi.mocked(api.createGrupo).mockResolvedValue({} as never);
  vi.mocked(api.updateGrupo).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('VacinaGruposPage', () => {
  it('lista grupos após carregar', async () => {
    renderPage();
    expect(screen.getByText('Carregando grupos…')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Crianças')).toBeInTheDocument());
  });

  it('cria grupo e recarrega', async () => {
    renderPage();
    await screen.findByText('Crianças');
    fireEvent.change(screen.getByLabelText('Nome', { selector: 'form input' }), { target: { value: 'Idosos' } });
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'idosos' } });
    fireEvent.change(screen.getByLabelText('Ordem', { selector: 'form input' }), { target: { value: '2' } });
    fireEvent.submit(screen.getByText('Criar grupo').closest('form')!);
    await waitFor(() => expect(api.createGrupo).toHaveBeenCalledWith({ nome: 'Idosos', slug: 'idosos', ordem: 2 }));
    expect(api.fetchGrupos).toHaveBeenCalledTimes(2);
  });

  it('edita grupo inline e salva', async () => {
    renderPage();
    await screen.findByText('Crianças');
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByLabelText('Nome', { selector: 'td input' }), { target: { value: 'Crianças 0-5' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(api.updateGrupo).toHaveBeenCalledWith(1, { nome: 'Crianças 0-5', ordem: 1 }));
  });

  it('alterna ativo', async () => {
    renderPage();
    await screen.findByText('Crianças');
    fireEvent.click(screen.getByText('Inativar'));
    await waitFor(() => expect(api.updateGrupo).toHaveBeenCalledWith(1, { ativo: false }));
  });

  it('cancela edição inline', async () => {
    renderPage();
    await screen.findByText('Crianças');
    fireEvent.click(screen.getByText('Editar'));
    expect(screen.getByLabelText('Nome', { selector: 'td input' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancelar'));
    await waitFor(() => expect(screen.queryByLabelText('Nome', { selector: 'td input' })).toBeNull());
  });

  it('mostra erro quando salvar edição falha', async () => {
    vi.mocked(api.updateGrupo).mockRejectedValueOnce(new Error('ordem inválida'));
    renderPage();
    await screen.findByText('Crianças');
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByLabelText('Ordem', { selector: 'td input' }), { target: { value: '9' } });
    fireEvent.click(screen.getByText('Salvar'));
    await waitFor(() => expect(screen.getByText('ordem inválida')).toBeInTheDocument());
  });

  it('mostra erro ao alternar status', async () => {
    vi.mocked(api.updateGrupo).mockRejectedValueOnce(new Error('status travado'));
    renderPage();
    await screen.findByText('Crianças');
    fireEvent.click(screen.getByText('Inativar'));
    await waitFor(() => expect(screen.getByText('status travado')).toBeInTheDocument());
  });

  it('mostra erro quando carga falha', async () => {
    vi.mocked(api.fetchGrupos).mockRejectedValueOnce(new Error('rede caiu'));
    renderPage();
    await waitFor(() => expect(screen.getByText('rede caiu')).toBeInTheDocument());
  });

  it('mostra erro quando criação falha', async () => {
    vi.mocked(api.createGrupo).mockRejectedValueOnce(new Error('nome duplicado'));
    renderPage();
    await screen.findByText('Crianças');
    const form = screen.getByText('Criar grupo').closest('form')!;
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'X' } });
    fireEvent.change(within(form).getByLabelText('Slug'), { target: { value: 'x' } });
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByText('nome duplicado')).toBeInTheDocument());
  });
});
