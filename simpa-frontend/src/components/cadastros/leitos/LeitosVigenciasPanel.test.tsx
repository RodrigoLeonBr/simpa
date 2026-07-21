import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeitosVigencia } from '../../../types/cadastros';
import { createLeitosVigencia } from '../../../api/cadastros';
import { LeitosVigenciasPanel } from './LeitosVigenciasPanel';

vi.mock('../../../api/cadastros', () => ({
  createLeitosVigencia: vi.fn(),
  updateLeitosVigencia: vi.fn(),
  deleteLeitosVigencia: vi.fn(),
}));

const VIGENCIA_ATUAL: LeitosVigencia = {
  id: 1,
  estabelecimento_id: 10,
  vigencia_inicio: '202410',
  vigencia_fim: '999999',
  leitos: { uti_adulto: 17 },
  leitos_detalhe: {},
};

describe('LeitosVigenciasPanel', () => {
  afterEach(() => cleanup());

  it('lista vigências existentes com período formatado', () => {
    render(
      <LeitosVigenciasPanel
        estabelecimentoId={10}
        vigencias={[VIGENCIA_ATUAL]}
        onChanged={vi.fn()}
      />,
    );

    expect(screen.getByText('Leitos por vigência')).toBeInTheDocument();
    expect(screen.getByText(/10\/2024/)).toBeInTheDocument();
    expect(screen.getByText(/99\/9999/)).toBeInTheDocument();
  });

  it('em modo readOnly não exibe ações de edição', () => {
    render(
      <LeitosVigenciasPanel
        estabelecimentoId={10}
        vigencias={[VIGENCIA_ATUAL]}
        readOnly
        onChanged={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Nova vigência/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir/i })).not.toBeInTheDocument();
  });

  it('bloqueia submissão quando detalhamento é inconsistente com o resumo', async () => {
    const user = userEvent.setup();
    render(
      <LeitosVigenciasPanel estabelecimentoId={10} vigencias={[]} onChanged={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /Nova vigência/i }));

    await user.type(screen.getByLabelText(/Vigência início/i), '10/2024');
    await user.type(screen.getByLabelText(/UTI Adulto/i), '17');
    await user.type(screen.getByLabelText(/75 - UTI-A Tipo II/i), '10');

    await user.click(screen.getByRole('button', { name: /Salvar vigência/i }));

    expect(await screen.findByText(/uti_adulto/i)).toBeInTheDocument();
    expect(createLeitosVigencia).not.toHaveBeenCalled();
  });

  it('submete vigência quando detalhamento é consistente com o resumo', async () => {
    const onChanged = vi.fn();
    const user = userEvent.setup();
    vi.mocked(createLeitosVigencia).mockResolvedValue({
      ...VIGENCIA_ATUAL,
      id: 2,
    });

    render(<LeitosVigenciasPanel estabelecimentoId={10} vigencias={[]} onChanged={onChanged} />);

    await user.click(screen.getByRole('button', { name: /Nova vigência/i }));

    await user.type(screen.getByLabelText(/Vigência início/i), '10/2024');
    await user.type(screen.getByLabelText(/UTI Adulto/i), '17');
    await user.type(screen.getByLabelText(/75 - UTI-A Tipo II/i), '17');

    await user.click(screen.getByRole('button', { name: /Salvar vigência/i }));

    await waitFor(() => {
      expect(createLeitosVigencia).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          vigencia_inicio: '202410',
          vigencia_fim: '999999',
          leitos: expect.objectContaining({ uti_adulto: 17 }),
          leitos_detalhe: expect.objectContaining({ '75': 17 }),
        }),
      );
    });

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalled();
    });
  });
});
