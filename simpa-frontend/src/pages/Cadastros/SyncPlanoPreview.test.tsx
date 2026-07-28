import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { SyncPlanoPreview } from './SyncPlanoPreview';
import type { SyncPlano } from '../../types/cadastros';

const plano: SyncPlano = {
  estabelecimentos: [
    { chave: '111', tipo: 'alterado', diff: { status: { simpa: 'ativo', mysql: 'inativo' } } },
    { chave: '222', tipo: 'novo', diff: { nome: { mysql: 'UBS NOVA' } } },
  ],
  procedimentos: [],
  resumo: {
    estabelecimentos: { novo: 1, alterado: 1, sumiu: 0 },
    procedimentos: { novo: 0, alterado: 0, sumiu: 0 },
  },
  sincronizado_em: '2026-07-28T12:00:00+00:00',
};

describe('SyncPlanoPreview', () => {
  afterEach(() => cleanup());
  it('monta payload só com itens marcados aplicar', () => {
    const onAplicar = vi.fn();
    render(<SyncPlanoPreview plano={plano} onAplicar={onAplicar} onCancelar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /aplicar todos/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onAplicar).toHaveBeenCalledTimes(1);
    const itens = onAplicar.mock.calls[0][0];
    expect(itens).toHaveLength(2);
    expect(itens.every((i: { entidade: string }) => i.entidade === 'estabelecimento')).toBe(true);
  });

  it('não inclui itens deixados em manter', () => {
    const onAplicar = vi.fn();
    render(<SyncPlanoPreview plano={plano} onAplicar={onAplicar} onCancelar={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onAplicar).toHaveBeenCalledWith([]);
  });
});
