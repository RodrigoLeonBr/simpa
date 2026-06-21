import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEstabelecimentos } from '../../api/cadastros';
import { EstabelecimentoMappingSelect } from './EstabelecimentoMappingSelect';

vi.mock('../../api/cadastros', () => ({
  fetchEstabelecimentos: vi.fn(),
}));

describe('EstabelecimentoMappingSelect', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(fetchEstabelecimentos).mockResolvedValue({
      data: [
        {
          id: 55,
          codigo_externo: '1234567',
          nome: 'P.M. 10 ZANAGA II',
          cnpj: null,
          re_tipo: null,
          tipouni: null,
          perfil: 'APS',
          perfil_editado: false,
          area: null,
          relatorio: null,
          status: 'ativo',
          sincronizado_em: null,
        },
      ],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    });
  });

  it('shows suggestions in dropdown by default', () => {
    render(
      <EstabelecimentoMappingSelect
        value={null}
        suggestions={[
          { id: 1, codigo_externo: '111', nome: 'UBS JARDIM SAO PAULO', score: 0.1 },
          { id: 2, codigo_externo: '222', nome: 'P.M. 10 ZANAGA II', score: 0.8 },
        ]}
        onChange={vi.fn()}
      />,
    );

    const select = screen.getByTestId('mapping-estabelecimento-select');
    expect(select).toHaveTextContent('UBS JARDIM SAO PAULO');
    expect(select).toHaveTextContent('P.M. 10 ZANAGA II');
    expect(screen.getByTestId('mapping-search-toggle')).toBeInTheDocument();
  });

  it('selects a suggestion directly from the dropdown', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <EstabelecimentoMappingSelect
        value={null}
        suggestions={[
          { id: '2' as unknown as number, codigo_externo: '222', nome: 'P.M. 10 ZANAGA II', score: 0.8 },
        ]}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByTestId('mapping-estabelecimento-select'), '2');

    expect(onChange).toHaveBeenCalledWith({
      id: 2,
      codigo_externo: '222',
      nome: 'P.M. 10 ZANAGA II',
    });
  });

  it('loads cadastro search results when manual search is used', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <EstabelecimentoMappingSelect value={null} suggestions={[]} onChange={onChange} />,
    );

    await user.type(screen.getByTestId('mapping-estabelecimento-search'), 'ZANAGA');

    await waitFor(() => {
      expect(fetchEstabelecimentos).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'ZANAGA', limit: 50 }),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('mapping-estabelecimento-select')).toHaveTextContent(
        'P.M. 10 ZANAGA II',
      );
    });

    await user.selectOptions(screen.getByTestId('mapping-estabelecimento-select'), '55');

    expect(onChange).toHaveBeenCalledWith({
      id: 55,
      codigo_externo: '1234567',
      nome: 'P.M. 10 ZANAGA II',
    });
  });

  it('keeps selected value visible when parent updates', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState<number | null>(null);
      const [label, setLabel] = useState<{ codigo_externo: string; nome: string } | null>(null);

      return (
        <EstabelecimentoMappingSelect
          value={value}
          selectedLabel={label}
          suggestions={[]}
          onChange={(selected) => {
            setValue(selected?.id ?? null);
            setLabel(
              selected
                ? { codigo_externo: selected.codigo_externo, nome: selected.nome }
                : null,
            );
          }}
        />
      );
    }

    render(<Harness />);

    await user.type(screen.getByTestId('mapping-estabelecimento-search'), 'ZANAGA');

    await waitFor(() => {
      expect(screen.getByTestId('mapping-estabelecimento-select')).toHaveTextContent(
        'P.M. 10 ZANAGA II',
      );
    });

    await user.selectOptions(screen.getByTestId('mapping-estabelecimento-select'), '55');

    expect(screen.getByTestId('mapping-estabelecimento-select')).toHaveValue('55');
  });
});
