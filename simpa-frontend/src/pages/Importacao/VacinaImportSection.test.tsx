import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCargas, importVacina, previewVacina } from '../../api/vacina';
import { VacinaImportSection } from './VacinaImportSection';

vi.mock('../../api/vacina', async () => {
  const actual = await vi.importActual<typeof import('../../api/vacina')>('../../api/vacina');
  return {
    ...actual,
    previewVacina: vi.fn(),
    importVacina: vi.fn(),
    fetchCargas: vi.fn(),
  };
});

const mockPreviewVacina = vi.mocked(previewVacina);
const mockImportVacina = vi.mocked(importVacina);
const mockFetchCargas = vi.mocked(fetchCargas);

const sampleCargas = [
  {
    id: 3,
    competencia: '2026-03-01',
    arquivo_nome: 'vacina_mar_2026.xlsx',
    linhas: 3055,
    doses_total: 14811,
    importado_por: 'planejamento',
    importado_em: '2026-10-13T13:22:00.000Z',
    status: 'ok',
  },
];

const samplePreview = {
  competencia: '2026-01-01',
  doses_total: 1200,
  linhas: 48,
  faixas_nao_mapeadas: [] as string[],
};

const sampleImportResult = {
  carga_id: 7,
  competencia: '2026-01-01',
  doses_total: 1200,
  linhas: 48,
};

function makeFile() {
  return new File(['dummy'], 'vacina_jan_2026.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPreviewVacina.mockResolvedValue(samplePreview);
  mockImportVacina.mockResolvedValue(sampleImportResult);
  mockFetchCargas.mockResolvedValue([]);
});

afterEach(() => cleanup());

describe('VacinaImportSection rendering', () => {
  it('renders the section heading', () => {
    render(<VacinaImportSection />);
    expect(screen.getByTestId('vacina-import-section')).toBeInTheDocument();
    expect(screen.getByText('Vacinas (NIES)')).toBeInTheDocument();
  });

  it('preview button is disabled without a file', () => {
    render(<VacinaImportSection />);
    expect(screen.getByTestId('vacina-preview-btn')).toBeDisabled();
  });
});

describe('VacinaImportSection preview flow', () => {
  it('calls previewVacina and shows competência and doses after file select + preview click', async () => {
    const user = userEvent.setup();
    render(<VacinaImportSection />);

    const input = screen.getByTestId('vacina-import-file') as HTMLInputElement;
    await user.upload(input, makeFile());

    expect(screen.getByTestId('vacina-preview-btn')).not.toBeDisabled();
    await user.click(screen.getByTestId('vacina-preview-btn'));

    await waitFor(() => {
      expect(mockPreviewVacina).toHaveBeenCalledTimes(1);
      const preview = screen.getByTestId('vacina-import-preview');
      expect(preview).toHaveTextContent('2026-01');
      expect(preview).toHaveTextContent('1200');
    });
  });

  it('shows amber warning when faixas_nao_mapeadas is non-empty', async () => {
    mockPreviewVacina.mockResolvedValue({
      ...samplePreview,
      faixas_nao_mapeadas: ['<1 ano', '65+ anos'],
    });

    const user = userEvent.setup();
    render(<VacinaImportSection />);

    await user.upload(screen.getByTestId('vacina-import-file'), makeFile());
    await user.click(screen.getByTestId('vacina-preview-btn'));

    await waitFor(() => {
      const warning = screen.getByTestId('vacina-import-warning');
      expect(warning).toBeInTheDocument();
      expect(warning).toHaveTextContent('<1 ano');
      expect(warning).toHaveTextContent('65+ anos');
    });
  });
});

describe('VacinaImportSection confirm flow', () => {
  it('calls importVacina with competencia and shows success message, then resets', async () => {
    const user = userEvent.setup();
    render(<VacinaImportSection />);

    await user.upload(screen.getByTestId('vacina-import-file'), makeFile());
    await user.click(screen.getByTestId('vacina-preview-btn'));
    await screen.findByTestId('vacina-import-preview');

    await user.click(screen.getByTestId('vacina-confirm-btn'));

    await waitFor(() => {
      expect(mockImportVacina).toHaveBeenCalledWith(expect.any(File), '2026-01');
      expect(screen.getByTestId('vacina-import-success')).toHaveTextContent('2026-01');
      expect(screen.getByTestId('vacina-import-success')).toHaveTextContent('1200 doses');
      // preview panel is gone after success
      expect(screen.queryByTestId('vacina-import-preview')).not.toBeInTheDocument();
    });
  });

  it('shows error message when importVacina rejects', async () => {
    mockImportVacina.mockRejectedValue(new Error('Servidor indisponível'));

    const user = userEvent.setup();
    render(<VacinaImportSection />);

    await user.upload(screen.getByTestId('vacina-import-file'), makeFile());
    await user.click(screen.getByTestId('vacina-preview-btn'));
    await screen.findByTestId('vacina-import-preview');

    await user.click(screen.getByTestId('vacina-confirm-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('vacina-import-error')).toHaveTextContent('Servidor indisponível');
    });
  });
});

describe('VacinaImportSection histórico', () => {
  it('lista as cargas retornadas por fetchCargas', async () => {
    mockFetchCargas.mockResolvedValue(sampleCargas);
    render(<VacinaImportSection />);

    await waitFor(() => {
      const hist = screen.getByTestId('vacina-cargas-historico');
      expect(hist).toHaveTextContent('2026-03');
      expect(hist).toHaveTextContent('vacina_mar_2026.xlsx');
      expect(hist).toHaveTextContent('14811');
    });
  });

  it('mostra estado vazio quando não há cargas', async () => {
    mockFetchCargas.mockResolvedValue([]);
    render(<VacinaImportSection />);
    await waitFor(() => {
      expect(screen.getByTestId('vacina-cargas-vazio')).toBeInTheDocument();
    });
  });

  it('avisa que vai substituir quando a competência do preview já existe', async () => {
    mockFetchCargas.mockResolvedValue(sampleCargas);
    mockPreviewVacina.mockResolvedValue({
      ...samplePreview,
      competencia: '2026-03-01',
    });

    const user = userEvent.setup();
    render(<VacinaImportSection />);
    await screen.findByText('vacina_mar_2026.xlsx'); // histórico carregado

    await user.upload(screen.getByTestId('vacina-import-file'), makeFile());
    await user.click(screen.getByTestId('vacina-preview-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('vacina-import-substituir')).toHaveTextContent('2026-03');
      expect(screen.getByTestId('vacina-confirm-btn')).toHaveTextContent('Confirmar substituição');
    });
  });

  it('não avisa substituição para competência nova', async () => {
    mockFetchCargas.mockResolvedValue(sampleCargas);
    // samplePreview = 2026-01, não presente em sampleCargas (2026-03)
    const user = userEvent.setup();
    render(<VacinaImportSection />);
    await screen.findByText('vacina_mar_2026.xlsx');

    await user.upload(screen.getByTestId('vacina-import-file'), makeFile());
    await user.click(screen.getByTestId('vacina-preview-btn'));

    await screen.findByTestId('vacina-import-preview');
    expect(screen.queryByTestId('vacina-import-substituir')).not.toBeInTheDocument();
    expect(screen.getByTestId('vacina-confirm-btn')).toHaveTextContent('Confirmar importação');
  });
});
