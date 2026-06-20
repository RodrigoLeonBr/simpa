import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewUpload, uploadCargas } from '../../api/importacao';
import { AuthProvider } from '../../contexts/AuthContext';
import { AUTH_STORAGE_KEY } from '../../types/auth';
import type { PreviewCargaEnriquecida } from '../../types/importacao';
import { UploadZone } from './UploadZone';

vi.mock('../../api/importacao', () => ({
  previewUpload: vi.fn(),
  uploadCargas: vi.fn(),
}));

const resolvedPreview: PreviewCargaEnriquecida = {
  nome: 'relatorio.csv',
  tipo_relatorio: 'atendimento_individual',
  competencia: '2026-05',
  esus_unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
  esus_equipe_nome: 'EQUIPE 9 EAP',
  esus_equipe_codigo: '0009',
  mapeamento_status: 'resolved',
  estabelecimento_id: 42,
  estabelecimento_codigo: '7169698',
  estabelecimento_nome: 'CAFI',
  equipe_id: 7,
  ja_importado: false,
};

const pendingPreview: PreviewCargaEnriquecida = {
  ...resolvedPreview,
  mapeamento_status: 'pending',
  estabelecimento_id: undefined,
  estabelecimento_codigo: undefined,
  estabelecimento_nome: undefined,
  equipe_id: undefined,
  sugestoes_estabelecimento: [
    { id: 42, codigo_externo: '7169698', nome: 'CAFI', score: 0.95 },
    { id: 99, codigo_externo: '9999999', nome: 'Outra UBS', score: 0.4 },
  ],
};

function seedPlanningAuth() {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      token: 'test-token',
      user: { username: 'plan', nome: 'Planner', perfil: 'Planejamento' },
    }),
  );
}

function renderUploadZone(props: { onUploadConcluido?: () => void } = {}) {
  return render(
    <AuthProvider>
      <UploadZone {...props} />
    </AuthProvider>,
  );
}

describe('UploadZone', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    seedPlanningAuth();
    vi.mocked(previewUpload).mockResolvedValue([resolvedPreview]);
    vi.mocked(uploadCargas).mockResolvedValue([{ carga_id: 99, status: 'ok' }]);
  });

  it('rejects non-csv files client-side', async () => {
    renderUploadZone({ onUploadConcluido: vi.fn() });

    const input = screen.getByTestId('upload-input');
    const badFile = new File(['x'], 'planilha.xlsx', { type: 'application/vnd.ms-excel' });

    fireEvent.change(input, { target: { files: [badFile] } });

    expect(screen.getByTestId('upload-validation-error')).toHaveTextContent('Somente arquivos .csv');
    expect(previewUpload).not.toHaveBeenCalled();
  });

  it('renders preview metadata fields after csv selection', async () => {
    renderUploadZone();

    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [new File(['a,b'], 'relatorio.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(previewUpload).toHaveBeenCalled();
    });

    expect(screen.getByTestId('preview-row')).toBeInTheDocument();
    expect(screen.getByText('relatorio.csv')).toBeInTheDocument();
    expect(screen.getByText('atendimento_individual')).toBeInTheDocument();
    expect(screen.getByText(/e-SUS: CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO/)).toBeInTheDocument();
    expect(screen.getByTestId('cadastro-target-label')).toHaveTextContent('7169698 · CAFI');
  });

  it('disables Process when any row has pending mapping', async () => {
    vi.mocked(previewUpload).mockResolvedValueOnce([pendingPreview]);

    renderUploadZone();
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [new File(['a,b'], 'relatorio.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('mapping-estabelecimento-select')).toBeInTheDocument();
    });

    expect(screen.getByTestId('upload-process-btn')).toBeDisabled();
  });

  it('enables Process after selecting establishment for pending row', async () => {
    const user = userEvent.setup();
    vi.mocked(previewUpload).mockResolvedValueOnce([pendingPreview]);

    renderUploadZone();
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [new File(['a,b'], 'relatorio.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('mapping-estabelecimento-select')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByTestId('mapping-estabelecimento-select'), '42');

    expect(screen.getByTestId('upload-process-btn')).toBeEnabled();
  });

  it('processes upload with resolucoes and notifies parent', async () => {
    const onUploadConcluido = vi.fn();
    const user = userEvent.setup();

    renderUploadZone({ onUploadConcluido });

    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [new File(['a,b'], 'relatorio.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Processar 1 arquivo/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /Processar 1 arquivo/i }));

    await waitFor(() => {
      expect(uploadCargas).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({
            arquivo: 'relatorio.csv',
            estabelecimento_id: 42,
            equipe_id: 7,
          }),
        ]),
      );
      expect(onUploadConcluido).toHaveBeenCalled();
    });
  });

  it('shows Todas conflict modal and confirms upload with flag', async () => {
    const user = userEvent.setup();
    const todasPreview: PreviewCargaEnriquecida = {
      ...resolvedPreview,
      mapeamento_status: 'blocked',
      conflito_todas: { exists: true, cargas_ids: [1], requires_confirm: true },
    };
    vi.mocked(previewUpload).mockResolvedValueOnce([todasPreview]);

    renderUploadZone();
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [new File(['a,b'], 'relatorio.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-process-btn')).toBeEnabled();
    });

    await user.click(screen.getByTestId('upload-process-btn'));

    expect(await screen.findByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Conflito com importação "Todas"/i })).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-dialog-action'));

    await waitFor(() => {
      expect(uploadCargas).toHaveBeenCalledWith(
        expect.any(Array),
        expect.arrayContaining([
          expect.objectContaining({
            arquivo: 'relatorio.csv',
            confirmar_remocao_todas: true,
          }),
        ]),
      );
    });
  });

  it('supports drag and drop and cancel preview', async () => {
    const user = userEvent.setup();
    renderUploadZone();

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

    renderUploadZone();
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [new File(['a,b'], 'invalid.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByText('Não foi possível detectar metadados do CSV')).toBeInTheDocument();
    });
  });

  it('blocks process for non-planning users', async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        token: 'test-token',
        user: { username: 'view', nome: 'Viewer', perfil: 'Visualizador' },
      }),
    );

    renderUploadZone();
    fireEvent.change(screen.getByTestId('upload-input'), {
      target: { files: [new File(['a,b'], 'relatorio.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('upload-planning-hint')).toBeInTheDocument();
    });

    expect(screen.getByTestId('upload-process-btn')).toBeDisabled();
  });
});
