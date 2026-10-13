import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetasOciParPage } from './MetasOciParPage';
import * as api from '../../api/cadastros';
import * as auth from '../../contexts/AuthContext';

vi.mock('../../api/cadastros');
vi.mock('../../contexts/AuthContext');

const META = {
  id: 7,
  competencia: '2026-01',
  tipo_oci: 'OCI-A',
  meta_quantidade: 10,
  meta_valor: 500,
  codigo_sigtap_prefix: '0301',
  periodicidade: 'mensal',
  origem: 'PAR-PMAE',
  estabelecimento_nome: 'UBS A',
} as unknown as api.MetaOciPar;

const asAdmin = () => vi.mocked(auth.useAuth).mockReturnValue({ user: { perfil: 'Administrador' } } as never);
const asViewer = () => vi.mocked(auth.useAuth).mockReturnValue({ user: { perfil: 'Leitura' } } as never);
const renderPage = () => render(<MemoryRouter><MetasOciParPage /></MemoryRouter>);

beforeEach(() => {
  asAdmin();
  vi.mocked(api.fetchMetasOciPar).mockResolvedValue([META]);
  vi.mocked(api.createMetaOciPar).mockResolvedValue({} as never);
  vi.mocked(api.updateMetaOciPar).mockResolvedValue({} as never);
  vi.mocked(api.inactivateMetaOciPar).mockResolvedValue({} as never);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('MetasOciParPage', () => {
  it('admin vê tabela e botão Nova meta', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('OCI-A')).toBeInTheDocument());
    expect(screen.getByText('Nova meta')).toBeInTheDocument();
  });

  it('não-editor não vê ações nem Nova meta', async () => {
    asViewer();
    renderPage();
    await waitFor(() => expect(screen.getByText('OCI-A')).toBeInTheDocument());
    expect(screen.queryByText('Nova meta')).toBeNull();
    expect(screen.queryByText('Editar')).toBeNull();
  });

  it('cria meta: mapPayload com valores preenchidos', async () => {
    renderPage();
    await screen.findByText('OCI-A');
    fireEvent.click(screen.getByText('Nova meta'));
    expect(screen.getByText('Nova meta OCI/PAR')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Competência (YYYY-MM)'), { target: { value: '2026-03' } });
    fireEvent.change(screen.getByLabelText('Tipo OCI'), { target: { value: 'OCI-B' } });
    fireEvent.change(screen.getByLabelText('Meta quantidade'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Meta valor (opcional)'), { target: { value: '900' } });
    fireEvent.change(screen.getByLabelText('Prefixo SIGTAP'), { target: { value: '0302' } });
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: 'PATE' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(api.createMetaOciPar).toHaveBeenCalledWith(
        expect.objectContaining({ competencia: '2026-03', tipo_oci: 'OCI-B', meta_quantidade: 20, meta_valor: 900, codigo_sigtap_prefix: '0302', periodicidade: 'mensal', origem: 'PATE' }),
      ),
    );
  });

  it('edita meta: mapPayload com meta_valor vazio → null e origem default', async () => {
    renderPage();
    await screen.findByText('OCI-A');
    fireEvent.click(screen.getByText('Editar'));
    expect(screen.getByText('Editar meta OCI/PAR')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Meta valor (opcional)'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Origem'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(api.updateMetaOciPar).toHaveBeenCalledWith(7, expect.objectContaining({ meta_valor: null, origem: 'PAR-PMAE' })),
    );
  });

  it('estado de carregamento', () => {
    vi.mocked(api.fetchMetasOciPar).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Carregando metas…')).toBeInTheDocument();
  });

  it('estado de erro', async () => {
    vi.mocked(api.fetchMetasOciPar).mockRejectedValueOnce(new Error('sem acesso'));
    renderPage();
    await waitFor(() => expect(screen.getByText('sem acesso')).toBeInTheDocument());
  });
});
