import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FiltersProvider } from '../../hooks/useFilters';
import ProcedimentosPage from './Procedimentos';
import {
  HELP_SILENT_SKIP,
  validateMapForm,
  buildCreateMapBody,
  emptyMapForm,
} from './procedimentoMapForm';

const SAMPLE_ROW = {
  id: 1,
  secao: 'Procedimentos - Teste rápido',
  descricao_esus: 'Para HIV',
  procedimento_id: 10,
  origem: 'seed',
  status: 'ativo',
  codigo_sigtap: '0214010058',
  descricao_sigtap: 'TESTE RAPIDO HIV',
};

function renderPage() {
  return render(
    <FiltersProvider>
      <MemoryRouter initialEntries={['/cadastros/procedimentos']}>
        <Routes>
          <Route path="/cadastros/procedimentos" element={<ProcedimentosPage />} />
        </Routes>
      </MemoryRouter>
    </FiltersProvider>
  );
}

describe('procedimentoMapForm', () => {
  it('validateMapForm rejects missing secao or descricao_esus', () => {
    expect(validateMapForm({ ...emptyMapForm(), codigo_sigtap: '0214010058' })).toMatch(
      /obrigat/
    );
    expect(
      validateMapForm({
        ...emptyMapForm(),
        secao: 'X',
        descricao_esus: '',
        codigo_sigtap: '0214010058',
      })
    ).toMatch(/obrigat/);
  });

  it('buildCreateMapBody strips non-digits from codigo_sigtap', () => {
    const body = buildCreateMapBody({
      secao: 'S',
      descricao_esus: 'L',
      codigo_sigtap: '0214.010.058',
      descricao: 'DESC',
      origem: 'manual',
    });
    expect(body.codigo_sigtap).toBe('0214010058');
    expect(body.secao).toBe('S');
  });
});

describe('ProcedimentosPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/esus-procedimento-map') && (!init || init.method === 'GET' || !init.method)) {
          return {
            ok: true,
            json: async () => [SAMPLE_ROW],
          } as Response;
        }
        if (url.includes('/esus-procedimento-map') && init?.method === 'POST') {
          return {
            ok: true,
            status: 201,
            json: async () => ({ ...SAMPLE_ROW, id: 2 }),
          } as Response;
        }
        if (url.includes('/esus-procedimento-map/') && init?.method === 'DELETE') {
          return {
            ok: true,
            json: async () => ({ inativado: true, id: 1 }),
          } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads list from mocked GET esus-procedimento-map', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Para HIV')).toBeInTheDocument();
    });
    expect(screen.getByText('0214010058')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/cadastros/esus-procedimento-map'),
    );
  });

  it('help text includes silent-skip wording', async () => {
    renderPage();
    expect(screen.getByText(HELP_SILENT_SKIP)).toBeInTheDocument();
    expect(screen.getByText(/silent skip/i)).toBeInTheDocument();
  });

  it('submitting without secao or descricao_esus shows validation and does not POST', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText('Para HIV'));

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/obrigat/);

    const posts = fetchMock.mock.calls.filter(
      (c) => c[1] && (c[1] as RequestInit).method === 'POST'
    );
    expect(posts).toHaveLength(0);
  });

  it('creating a map with codigo_sigtap posts expected body', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText('Para HIV'));

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();

    await user.type(screen.getByPlaceholderText(/Seção e-SUS/i), 'Procedimentos - Teste rápido');
    await user.type(screen.getByPlaceholderText(/Descrição e-SUS/i), 'Para Sífilis');
    await user.type(screen.getByPlaceholderText(/Código SIGTAP/i), '0214010040');
    await user.type(
      screen.getByPlaceholderText('Descrição SIGTAP (se criar código novo)'),
      'TESTE RAPIDO SIFILIS'
    );
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter(
        (c) => c[1] && (c[1] as RequestInit).method === 'POST'
      );
      expect(posts.length).toBeGreaterThanOrEqual(1);
      const body = JSON.parse(String((posts[0][1] as RequestInit).body));
      expect(body).toMatchObject({
        secao: 'Procedimentos - Teste rápido',
        descricao_esus: 'Para Sífilis',
        codigo_sigtap: '0214010040',
      });
    });
  });

  it('Inativar calls DELETE and refreshes list omitting inactive by default', async () => {
    const user = userEvent.setup();
    let listPayload = [SAMPLE_ROW];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/esus-procedimento-map/') && init?.method === 'DELETE') {
          listPayload = [];
          return {
            ok: true,
            json: async () => ({ inativado: true, id: 1 }),
          } as Response;
        }
        if (url.includes('/esus-procedimento-map')) {
          return {
            ok: true,
            json: async () => listPayload,
          } as Response;
        }
        return { ok: true, json: async () => [] } as Response;
      })
    );

    renderPage();
    await waitFor(() => screen.getByText('Para HIV'));

    await user.click(screen.getByRole('button', { name: 'Inativar' }));

    await waitFor(() => {
      expect(screen.queryByText('Para HIV')).not.toBeInTheDocument();
    });

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const deletes = fetchMock.mock.calls.filter(
      (c) => c[1] && (c[1] as RequestInit).method === 'DELETE'
    );
    expect(deletes.length).toBeGreaterThanOrEqual(1);
    expect(String(deletes[0][0])).toMatch(/esus-procedimento-map\/1/);
  });
});
