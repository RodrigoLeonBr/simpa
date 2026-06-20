import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fetchCargas, previewUpload, uploadCargas } from '../../api/importacao';
import ImportacaoPage from './index';

vi.mock('../../api/importacao', () => ({
  fetchCargas: vi.fn(),
  previewUpload: vi.fn(),
  uploadCargas: vi.fn(),
  reprocessarCarga: vi.fn(),
  substituirCarga: vi.fn(),
  excluirCarga: vi.fn(),
}));

const sampleCargas = [
  {
    id: 1,
    tipo_relatorio: 'atendimento_individual',
    competencia: '2026-05-01',
    unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
    equipe_nome: 'EQUIPE 9 EAP',
    arquivo_origem: 'relatorio.csv',
    registros_identificados: 540,
    registros_nao_identificados: 0,
    importado_em: '2026-06-13T17:50:00',
  },
];

describe('Importacao page integration', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(fetchCargas).mockResolvedValue(sampleCargas);
    vi.mocked(previewUpload).mockResolvedValue([
      {
        nome: 'novo.csv',
        tipo_relatorio: 'atendimento_individual',
        competencia: '2026-05',
        unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
        equipe_nome: 'EQUIPE 9 EAP',
        ja_importado: false,
      },
    ]);
    vi.mocked(uploadCargas).mockResolvedValue([{ carga_id: 2, status: 'ok' }]);
  });

  it('upload fixture triggers list refresh', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ImportacaoPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchCargas).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('historico-cargas')).toBeInTheDocument();
    });

    const input = screen.getByTestId('upload-input');
    await user.upload(input, new File(['a,b'], 'novo.csv', { type: 'text/csv' }));

    await waitFor(() => {
      expect(previewUpload).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('button', { name: /Processar 1 arquivo/i }));

    await waitFor(() => {
      expect(uploadCargas).toHaveBeenCalled();
      expect(vi.mocked(fetchCargas).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
