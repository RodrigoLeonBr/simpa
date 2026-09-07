import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGrupo,
  deleteEsquema,
  fetchEsquema,
  fetchFaixaGrupo,
  fetchGrupos,
  fetchImunobiologicos,
  fetchPopulacao,
  setFaixaGrupo,
  upsertPopulacao,
} from '../../api/vacina';
import { VacinaEsquemaPage } from './VacinaEsquemaPage';
import { VacinaFaixaGrupoPage } from './VacinaFaixaGrupoPage';
import { VacinaGruposPage } from './VacinaGruposPage';
import { VacinaPopulacaoPage } from './VacinaPopulacaoPage';

vi.mock('../../api/vacina', () => ({
  fetchGrupos: vi.fn(),
  createGrupo: vi.fn(),
  updateGrupo: vi.fn(),
  fetchFaixaGrupo: vi.fn(),
  setFaixaGrupo: vi.fn(),
  fetchPopulacao: vi.fn(),
  upsertPopulacao: vi.fn(),
  fetchEsquema: vi.fn(),
  upsertEsquema: vi.fn(),
  deleteEsquema: vi.fn(),
  fetchImunobiologicos: vi.fn(),
}));

const mockFetchGrupos = fetchGrupos as ReturnType<typeof vi.fn>;
const mockCreateGrupo = createGrupo as ReturnType<typeof vi.fn>;
const mockFetchFaixaGrupo = fetchFaixaGrupo as ReturnType<typeof vi.fn>;
const mockSetFaixaGrupo = setFaixaGrupo as ReturnType<typeof vi.fn>;
const mockFetchPopulacao = fetchPopulacao as ReturnType<typeof vi.fn>;
const mockUpsertPopulacao = upsertPopulacao as ReturnType<typeof vi.fn>;
const mockFetchEsquema = fetchEsquema as ReturnType<typeof vi.fn>;
const mockDeleteEsquema = deleteEsquema as ReturnType<typeof vi.fn>;
const mockFetchImunobiologicos = fetchImunobiologicos as ReturnType<typeof vi.fn>;

const GRUPOS = [{ id: 1, nome: 'Adultos', slug: 'adultos', ordem: 1, ativo: true }];
const FAIXAS = [{ faixa_nies: '20-29', grupo_id: 1 }];
const POPULACAO = [{ id: 1, ano: 2026, grupo_id: 1, grupo_nome: 'Adultos', populacao: 5000 }];
const ESQUEMAS = [{ id: 1, imuno_codigo: 'COV19', imuno_nome: 'COVID-19', grupo_id: 1, grupo_nome: 'Adultos', num_doses: 2 }];
const IMUNIS = [{ imuno_codigo: 'COV19', imuno_nome: 'COVID-19' }];

afterEach(cleanup);

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('VacinaGruposPage', () => {
  beforeEach(() => {
    mockFetchGrupos.mockResolvedValue(GRUPOS);
    mockCreateGrupo.mockResolvedValue({ id: 2, nome: 'Crianças', slug: 'criancas', ordem: 2, ativo: true });
  });

  it('renders a group row after load', async () => {
    wrap(<VacinaGruposPage />);
    expect(await screen.findByText('Adultos')).toBeInTheDocument();
  });

  it('calls createGrupo on form submit', async () => {
    // Second fetchGrupos call (after create) returns updated list
    mockFetchGrupos
      .mockResolvedValueOnce(GRUPOS)
      .mockResolvedValueOnce([...GRUPOS, { id: 2, nome: 'Crianças', slug: 'criancas', ordem: 2, ativo: true }]);

    const user = userEvent.setup();
    wrap(<VacinaGruposPage />);
    await screen.findByText('Adultos');

    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Crianças');
    await user.type(screen.getByRole('textbox', { name: 'Slug' }), 'criancas');
    await user.click(screen.getByRole('button', { name: /Criar grupo/i }));

    await waitFor(() => {
      expect(mockCreateGrupo).toHaveBeenCalledWith({ nome: 'Crianças', slug: 'criancas', ordem: undefined });
    });
  });
});

describe('VacinaFaixaGrupoPage', () => {
  beforeEach(() => {
    mockFetchFaixaGrupo.mockResolvedValue(FAIXAS);
    mockFetchGrupos.mockResolvedValue(GRUPOS);
    mockSetFaixaGrupo.mockResolvedValue({ faixa_nies: '20-29', grupo_id: 1 });
  });

  it('renders a faixa row after load', async () => {
    wrap(<VacinaFaixaGrupoPage />);
    expect(await screen.findByText('20-29')).toBeInTheDocument();
  });

  it('calls setFaixaGrupo when select changes', async () => {
    mockFetchFaixaGrupo
      .mockResolvedValueOnce(FAIXAS)
      .mockResolvedValueOnce(FAIXAS);
    mockFetchGrupos.mockResolvedValue(GRUPOS);

    const user = userEvent.setup();
    wrap(<VacinaFaixaGrupoPage />);
    await screen.findByText('20-29');

    const select = screen.getByRole('combobox', { name: /Grupo para 20-29/i });
    await user.selectOptions(select, '1');

    await waitFor(() => {
      expect(mockSetFaixaGrupo).toHaveBeenCalledWith('20-29', 1);
    });
  });
});

describe('VacinaPopulacaoPage', () => {
  beforeEach(() => {
    mockFetchPopulacao.mockResolvedValue(POPULACAO);
    mockFetchGrupos.mockResolvedValue(GRUPOS);
    mockUpsertPopulacao.mockResolvedValue(POPULACAO[0]);
  });

  it('renders a population row after load', async () => {
    wrap(<VacinaPopulacaoPage />);
    // "Adultos" appears in both table cell and form select — use testid to scope
    const page = await screen.findByTestId('vacina-populacao-page');
    expect(page).toBeInTheDocument();
    expect(screen.getAllByText('Adultos').length).toBeGreaterThanOrEqual(1);
  });

  it('calls upsertPopulacao on form submit', async () => {
    mockFetchPopulacao
      .mockResolvedValueOnce(POPULACAO)
      .mockResolvedValueOnce(POPULACAO);

    const user = userEvent.setup();
    wrap(<VacinaPopulacaoPage />);
    await screen.findByTestId('vacina-populacao-page');
    // wait for data to load (table row appears)
    await waitFor(() => expect(screen.getAllByText('Adultos').length).toBeGreaterThanOrEqual(1));

    await user.selectOptions(screen.getByRole('combobox', { name: /Grupo/i }), '1');
    await user.type(screen.getByRole('spinbutton', { name: /^População/i }), '5000');
    await user.click(screen.getByRole('button', { name: /Salvar/i }));

    await waitFor(() => {
      expect(mockUpsertPopulacao).toHaveBeenCalledWith({ ano: 2026, grupo_id: 1, populacao: 5000 });
    });
  });
});

describe('VacinaEsquemaPage', () => {
  beforeEach(() => {
    mockFetchEsquema.mockResolvedValue(ESQUEMAS);
    mockFetchGrupos.mockResolvedValue(GRUPOS);
    mockFetchImunobiologicos.mockResolvedValue(IMUNIS);
    mockDeleteEsquema.mockResolvedValue({ id: 1 });
  });

  it('renders an esquema row after load', async () => {
    wrap(<VacinaEsquemaPage />);
    expect(await screen.findByText('COVID-19')).toBeInTheDocument();
  });

  it('calls deleteEsquema when Excluir is clicked', async () => {
    mockFetchEsquema
      .mockResolvedValueOnce(ESQUEMAS)
      .mockResolvedValueOnce([]);

    const user = userEvent.setup();
    wrap(<VacinaEsquemaPage />);
    await screen.findByText('COVID-19');

    await user.click(screen.getByRole('button', { name: /Excluir/i }));

    await waitFor(() => {
      expect(mockDeleteEsquema).toHaveBeenCalledWith(1);
    });
  });
});
