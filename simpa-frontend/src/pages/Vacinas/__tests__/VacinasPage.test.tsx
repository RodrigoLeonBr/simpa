import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import VacinasPage from '../index';

vi.mock('../../../api/vacina', () => ({
  fetchCobertura: vi.fn(),
}));

vi.mock('../../../utils/csv', () => ({
  downloadCsv: vi.fn(),
}));

vi.mock('../../../api/painelWidgets', () => ({
  fetchPainelLayout: vi.fn().mockResolvedValue({ widgets: [] }),
}));

// CoberturaMatrix is a real sibling — let it render (it's pure, no API calls).

import { fetchCobertura } from '../../../api/vacina';
import { downloadCsv } from '../../../utils/csv';

const mockFetch = fetchCobertura as ReturnType<typeof vi.fn>;
const mockDownload = downloadCsv as ReturnType<typeof vi.fn>;

const ROWS = [
  {
    imuno_codigo: 'COV19',
    imuno_nome: 'COVID-19',
    grupo_id: 1,
    grupo_nome: 'Adultos',
    doses: 800,
    pop_alvo: 1000,
    num_doses: 2,
    denominador: 2000,
    cobertura_pct: 40,
  },
];

afterEach(cleanup);

beforeEach(() => {
  mockFetch.mockReset();
  mockDownload.mockReset();
  mockFetch.mockResolvedValue(ROWS);
});

describe('VacinasPage', () => {
  it('renders the page title', async () => {
    render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    expect(screen.getByText(/Cobertura Vacinal 2026/i)).toBeInTheDocument();
    // Wait for loading to finish so async state settles
    await screen.findByTestId('vacinas-matrix');
  });

  it('fetches on mount and renders the matrix with vaccine name', async () => {
    render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    const cell = await screen.findByText('COVID-19');
    expect(cell).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith({ ano: 2026, competencia: '2026-12' });
  });

  it('refetches with new competencia when month changes', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue(ROWS);
    const { container } = render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith({ ano: 2026, competencia: '2026-12' }));

    mockFetch.mockResolvedValue(ROWS);
    const select = within(container).getByRole('combobox');
    await user.selectOptions(select, '06');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith({ ano: 2026, competencia: '2026-06' });
    });
  });

  it('shows empty message when API returns no rows', async () => {
    mockFetch.mockResolvedValue([]);
    render(<MemoryRouter><VacinasPage /></MemoryRouter>);
    const msg = await screen.findByTestId('vacinas-empty');
    expect(msg).toBeInTheDocument();
  });
});
