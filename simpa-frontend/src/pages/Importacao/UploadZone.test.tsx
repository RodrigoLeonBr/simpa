import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewUpload, uploadCargas } from '../../api/importacao';
import { UploadZone } from './UploadZone';

vi.mock('../../api/importacao', () => ({
  previewUpload: vi.fn(),
  uploadCargas: vi.fn(),
}));

describe('UploadZone', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(previewUpload).mockResolvedValue([
      {
        nome: 'relatorio.csv',
        tipo_relatorio: 'atendimento_individual',
        competencia: '2026-05',
        unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
        equipe_nome: 'EQUIPE 9 EAP',
        ja_importado: false,
      },
    ]);
    vi.mocked(uploadCargas).mockResolvedValue([{ carga_id: 99, status: 'ok' }]);
  });

  it('rejects non-csv files client-side', async () => {
    render(<UploadZone onUploadConcluido={vi.fn()} />);

    const input = screen.getByTestId('upload-input');
    const badFile = new File(['x'], 'planilha.xlsx', { type: 'application/vnd.ms-excel' });

    fireEvent.change(input, { target: { files: [badFile] } });

    expect(screen.getByTestId('upload-validation-error')).toHaveTextContent('Somente arquivos .csv');
    expect(previewUpload).not.toHaveBeenCalled();
  });

  it('renders preview metadata fields after csv selection', async () => {
    render(<UploadZone onUploadConcluido={vi.fn()} />);

    const input = screen.getByTestId('upload-input');
    const csvFile = new File(['a,b'], 'relatorio.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [csvFile] } });

    await waitFor(() => {
      expect(previewUpload).toHaveBeenCalled();
    });

    expect(screen.getByTestId('preview-row')).toBeInTheDocument();
    expect(screen.getByText('relatorio.csv')).toBeInTheDocument();
    expect(screen.getByText('atendimento_individual')).toBeInTheDocument();
    expect(screen.getByText(/2026-05 · CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO · EQUIPE 9 EAP/)).toBeInTheDocument();
  });

  it('processes upload and notifies parent', async () => {
    const onUploadConcluido = vi.fn();
    const user = userEvent.setup();

    render(<UploadZone onUploadConcluido={onUploadConcluido} />);

    const input = screen.getByTestId('upload-input');
    fireEvent.change(input, {
      target: { files: [new File(['a,b'], 'relatorio.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Processar 1 arquivo/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Processar 1 arquivo/i }));

    await waitFor(() => {
      expect(uploadCargas).toHaveBeenCalled();
      expect(onUploadConcluido).toHaveBeenCalled();
    });
  });

  it('supports drag and drop and cancel preview', async () => {
    const user = userEvent.setup();
    render(<UploadZone />);

    const zone = screen.getByTestId('upload-zone');
    fireEvent.dragOver(zone);
    expect(zone.className).toContain('dragging');

    fireEvent.drop(zone, {
      dataTransfer: {
        files: [new File(['a,b'], 'relatorio.csv', { type: 'text/csv' })],
      },
    });

    await waitFor(() => {
      expect(previewUpload).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText('Arraste os CSVs do e-SUS aqui')).toBeInTheDocument();
  });

  it('shows preview errors from api', async () => {
    vi.mocked(previewUpload).mockResolvedValueOnce([
      { nome: 'invalid.csv', error: 'Não foi possível detectar metadados do CSV' },
    ]);

    render(<UploadZone />);
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [new File(['a,b'], 'invalid.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Não foi possível detectar metadados do CSV')).toBeInTheDocument();
    });
  });
});
