import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateEnrichmentBySlug, updatePerfil } from '../../api/cadastros';
import { AuthProvider } from '../../contexts/AuthContext';
import { AUTH_STORAGE_KEY } from '../../types/auth';
import type { Estabelecimento } from '../../types/cadastros';
import { EstabelecimentoDetailDrawer } from './EstabelecimentoDetailDrawer';

vi.mock('../../api/cadastros', async () => {
  const actual = await vi.importActual<typeof import('../../api/cadastros')>('../../api/cadastros');
  return {
    ...actual,
    updatePerfil: vi.fn(),
    updateEnrichmentBySlug: vi.fn(),
  };
});

const baseEstabelecimento: Estabelecimento = {
  id: 1,
  codigo_externo: 'H001',
  nome: 'Hospital Municipal',
  perfil: 'Hospitalar',
  perfil_editado: false,
  status: 'ativo',
  enrichment: { leitos: { clinico: 5 } },
};

function seedAuth(perfil: string) {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      token: 'test-token',
      user: { username: 'user', nome: 'User', perfil },
    }),
  );
}

function renderDrawer(
  estabelecimento: Estabelecimento = baseEstabelecimento,
  onSaved = vi.fn(),
) {
  return render(
    <AuthProvider>
      <EstabelecimentoDetailDrawer
        estabelecimento={estabelecimento}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    </AuthProvider>,
  );
}

describe('EstabelecimentoDetailDrawer', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders perfil as readonly input for non-planning user', () => {
    seedAuth('Visualizador');
    renderDrawer();

    expect(screen.getByTestId('estabelecimento-perfil-readonly')).toBeDisabled();
    expect(screen.queryByTestId('estabelecimento-perfil-select')).not.toBeInTheDocument();
    expect(screen.queryByTestId('enrichment-form')).not.toBeInTheDocument();
  });

  it('renders perfil select for planning user', () => {
    seedAuth('Planejamento');
    renderDrawer();

    expect(screen.getByTestId('estabelecimento-perfil-select')).toBeInTheDocument();
    expect(screen.queryByTestId('estabelecimento-perfil-readonly')).not.toBeInTheDocument();
    expect(screen.getByTestId('enrichment-form')).toBeInTheDocument();
  });

  it('saves perfil via updatePerfil', async () => {
    seedAuth('Administrador');
    const onSaved = vi.fn();
    vi.mocked(updatePerfil).mockResolvedValue({
      ...baseEstabelecimento,
      perfil: 'APS',
      perfil_editado: true,
    });

    const user = userEvent.setup();
    renderDrawer(baseEstabelecimento, onSaved);

    await user.selectOptions(screen.getByTestId('estabelecimento-perfil-select'), 'APS');
    await user.click(screen.getByRole('button', { name: /Salvar perfil/i }));

    await waitFor(() => {
      expect(updatePerfil).toHaveBeenCalledWith(1, 'APS');
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ perfil: 'APS', perfil_editado: true }),
      );
    });
  });

  it('does not show locked perfil in SIA section', () => {
    seedAuth('Planejamento');
    renderDrawer();

    expect(screen.queryByTestId('locked-field-perfil')).not.toBeInTheDocument();
  });
});
