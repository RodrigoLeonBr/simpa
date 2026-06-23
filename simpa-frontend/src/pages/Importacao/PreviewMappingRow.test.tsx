import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreviewMappingRow } from './PreviewMappingRow';

vi.mock('./EstabelecimentoMappingSelect', () => ({
  EstabelecimentoMappingSelect: () => null,
}));

const baseItem = {
  nome: 'relatorio.csv',
  tipo_relatorio: 'atendimento_individual',
  competencia: '2026-05-01',
  esus_unidade: 'CAFI CENTRO DE ASSISTENCIA A FAMILIA E AO IDOSO',
  esus_equipe_nome: 'EQUIPE 9 EAP',
  esus_equipe_codigo: '0002200376',
  mapeamento_status: 'resolved' as const,
  estabelecimento_id: 5,
  estabelecimento_nome: 'CAFI',
  estabelecimento_codigo: 'CAFI001',
  equipe_id: 10,
  equipe_nome: 'EQUIPE 9 EAP',
  sugestoes_estabelecimento: [],
  ja_importado: false,
};

const baseDraft = {
  estabelecimento_id: 5,
  estabelecimento_codigo: 'CAFI001',
  estabelecimento_nome: 'CAFI',
  equipe_id: 10,
  salvar_mapeamento: false,
};

afterEach(() => {
  cleanup();
});

describe('PreviewMappingRow — cidadaos_ativos badge', () => {
  it('renders cidadaos_ativos badge "3.337 cidadãos" for cadastro_individual with 3337', () => {
    render(
      <PreviewMappingRow
        item={{ ...baseItem, tipo_relatorio: 'cadastro_individual', cidadaos_ativos: 3337 }}
        draft={baseDraft}
        canEdit={false}
        onDraftChange={vi.fn()}
      />,
    );
    const badge = screen.getByTestId('cidadaos-ativos-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3.337 cidadãos');
  });

  it('does NOT render cidadaos_ativos badge for atendimento_individual', () => {
    render(
      <PreviewMappingRow
        item={{ ...baseItem, tipo_relatorio: 'atendimento_individual' }}
        draft={baseDraft}
        canEdit={false}
        onDraftChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('cidadaos-ativos-badge')).toBeNull();
  });

  it('does NOT render badge for cadastro_individual without cidadaos_ativos', () => {
    render(
      <PreviewMappingRow
        item={{ ...baseItem, tipo_relatorio: 'cadastro_individual', cidadaos_ativos: undefined }}
        draft={baseDraft}
        canEdit={false}
        onDraftChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('cidadaos-ativos-badge')).toBeNull();
  });

  it('renders tipo_relatorio tag for all types', () => {
    render(
      <PreviewMappingRow
        item={{ ...baseItem, tipo_relatorio: 'cadastro_individual', cidadaos_ativos: 10 }}
        draft={baseDraft}
        canEdit={false}
        onDraftChange={vi.fn()}
      />,
    );
    expect(screen.getByText('cadastro_individual')).toBeInTheDocument();
  });
});
