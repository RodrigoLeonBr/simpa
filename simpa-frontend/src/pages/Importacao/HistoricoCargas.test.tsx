import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { excluirCarga, reprocessarCarga, substituirCarga } from '../../api/importacao';
import type { CargaEsus } from '../../types/contrato';
import { HistoricoCargas } from './HistoricoCargas';

vi.mock('../../api/importacao', () => ({
  reprocessarCarga: vi.fn(),
  substituirCarga: vi.fn(),
  excluirCarga: vi.fn(),
}));

const sampleCargas: CargaEsus[] = [
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
  {
    id: 2,
    tipo_relatorio: 'atendimento_individual',
    competencia: '2026-04-01',
    unidade: 'UBS JARDIM SAO PAULO',
    equipe_nome: 'ESF 07',
    arquivo_origem: 'parcial.csv',
    registros_identificados: 10,
    registros_nao_identificados: 2,
    importado_em: '2026-06-12T10:00:00',
  },
  {
    id: 3,
    tipo_relatorio: 'atendimento_individual',
    competencia: '2026-03-01',
    unidade: 'UBS JARDIM SAO PAULO',
    equipe_nome: 'ESF 07',
    arquivo_origem: 'pendente.csv',
    registros_identificados: null,
    registros_nao_identificados: null,
    importado_em: '2026-06-11T10:00:00',
  },
];

function buildManyCargas(count: number): CargaEsus[] {
  return Array.from({ length: count }, (_, index) => ({
    ...sampleCargas[0]!,
    id: index + 1,
    competencia: `2026-${String(Math.max(1, 12 - (index % 12))).padStart(2, '0')}-01`,
    unidade: `UNIDADE ${index + 1}`,
    equipe_nome: `EQUIPE ${index + 1}`,
    importado_em: `2026-06-${String(Math.max(1, 28 - (index % 28))).padStart(2, '0')}T10:00:00`,
  }));
}

describe('HistoricoCargas', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(reprocessarCarga).mockResolvedValue({ status: 'ok' });
    vi.mocked(substituirCarga).mockResolvedValue({ status: 'ok' });
    vi.mocked(excluirCarga).mockResolvedValue({ deleted: true, id: 1 });
  });

  it('renders empty state', () => {
    render(<HistoricoCargas cargas={[]} onAtualizar={vi.fn()} />);
    expect(screen.getByText('Nenhuma carga importada ainda.')).toBeInTheDocument();
  });

  it('renders status badges for ok, partial and processing rows', () => {
    render(<HistoricoCargas cargas={sampleCargas} onAtualizar={vi.fn()} />);

    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('Parcial')).toBeInTheDocument();
    expect(screen.getByText('Processando')).toBeInTheDocument();
    expect(screen.getByText(/\/ 2 rej\./)).toBeInTheDocument();
  });

  it('reprocesses a carga and refreshes list', async () => {
    const onAtualizar = vi.fn();
    const user = userEvent.setup();

    render(<HistoricoCargas cargas={sampleCargas} onAtualizar={onAtualizar} />);

    await user.click(screen.getAllByTitle('Reprocessar')[0]!);

    await waitFor(() => {
      expect(reprocessarCarga).toHaveBeenCalledWith(1);
      expect(onAtualizar).toHaveBeenCalled();
    });
  });

  it('substitutes csv file for a carga', async () => {
    const onAtualizar = vi.fn();

    render(<HistoricoCargas cargas={sampleCargas} onAtualizar={onAtualizar} />);

    fireEvent.click(screen.getAllByTitle('Substituir arquivo')[0]!);
    fireEvent.change(screen.getByTestId('replace-input'), {
      target: { files: [new File(['a,b'], 'novo.csv', { type: 'text/csv' })] },
    });

    await waitFor(() => {
      expect(substituirCarga).toHaveBeenCalled();
      expect(onAtualizar).toHaveBeenCalled();
    });
  });

  it('requires confirmation before deleting a carga', async () => {
    const onAtualizar = vi.fn();
    const user = userEvent.setup();

    render(<HistoricoCargas cargas={sampleCargas} onAtualizar={onAtualizar} />);

    const deleteButtons = screen.getAllByTitle(/Excluir|confirmar/i);
    await user.click(deleteButtons[0]!);
    expect(excluirCarga).not.toHaveBeenCalled();

    await user.click(screen.getAllByTitle('Clique para confirmar')[0]!);

    await waitFor(() => {
      expect(excluirCarga).toHaveBeenCalledWith(1);
      expect(onAtualizar).toHaveBeenCalled();
    });
  });

  it('shows 15 cargas initially and loads 20 more on demand', async () => {
    const cargas = buildManyCargas(40);
    const user = userEvent.setup();

    render(<HistoricoCargas cargas={cargas} onAtualizar={vi.fn()} />);

    expect(screen.getByText('Exibindo 15 de 40')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(16);
    expect(screen.getByTestId('historico-cargas-load-more')).toHaveTextContent('Ver mais importações (20)');

    await user.click(screen.getByTestId('historico-cargas-load-more'));

    expect(screen.getByText('Exibindo 35 de 40')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(36);
    expect(screen.getByTestId('historico-cargas-load-more')).toHaveTextContent('Ver mais importações (5)');

    await user.click(screen.getByTestId('historico-cargas-load-more'));

    expect(screen.getByText('Exibindo 40 de 40')).toBeInTheDocument();
    expect(screen.queryByTestId('historico-cargas-load-more')).not.toBeInTheDocument();
  });
});
