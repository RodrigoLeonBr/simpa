jest.mock('../src/services/db', () => {
  const query = jest.fn();
  const mockClient = {
    query,
    release: jest.fn(),
  };
  return {
    query,
    pool: {
      connect: jest.fn(async () => mockClient),
    },
  };
});

const { query } = require('../src/services/db');
const {
  validateEnrichmentPayload,
  validateEnrichmentForSlug,
  listEstabelecimentos,
  updateEnriquecimento,
  updatePerfil,
  upsertEnrichment,
  getEstabelecimentoById,
  mergeEnrichment,
  mergeEnrichmentForSlug,
} = require('../src/services/estabelecimentosService');

const hospitalDetailRow = {
  id: 1,
  codigo_externo: '1234567',
  nome: 'Hospital X',
  cnpj: null,
  re_tipo: null,
  tipouni: null,
  perfil: 'Hospitalar',
  perfil_editado: false,
  area: null,
  relatorio: null,
  status: 'ativo',
  sincronizado_em: null,
  eh_leitos: { clinico: 10 },
  especialidades: ['Cardio'],
  habilitacoes: [],
  capacidade_notas: null,
  eh_notas: 'legado',
};

const hospitalCoreRow = {
  id: 1,
  codigo_externo: '1234567',
  nome: 'Hospital X',
  perfil: 'Hospitalar',
  perfil_editado: false,
};

function mockTransactionalQuery(handler) {
  query.mockImplementation((sql, params) => {
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return Promise.resolve({ rows: [] });
    }
    return handler(sql, params);
  });
}

describe('estabelecimentosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  describe('validateEnrichmentPayload', () => {
    it('accepts valid leitos object', () => {
      const result = validateEnrichmentPayload({
        leitos: { clinico: 10, cirurgico: 5 },
      });
      expect(result.ok).toBe(true);
    });

    it('rejects identity fields like nome', () => {
      const result = validateEnrichmentPayload({ nome: 'hack' });
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/nome/i);
    });

    it('rejects invalid leitos values', () => {
      const result = validateEnrichmentPayload({ leitos: { clinico: -1 } });
      expect(result.ok).toBe(false);
    });

    it('rejects non-integer leitos values', () => {
      const result = validateEnrichmentPayload({ leitos: { clinico: 10.5 } });
      expect(result.ok).toBe(false);
    });

    it('rejects empty payload', () => {
      const result = validateEnrichmentPayload({});
      expect(result.ok).toBe(false);
    });
  });

  describe('validateEnrichmentForSlug', () => {
    it('accepts APS optional string fields', () => {
      const result = validateEnrichmentForSlug('aps', {
        notas_territorio: 'Território norte',
      });
      expect(result.ok).toBe(true);
    });

    it('accepts MAC capacidades array', () => {
      const result = validateEnrichmentForSlug('mac', {
        capacidades: ['Hemodinâmica'],
      });
      expect(result.ok).toBe(true);
    });
  });

  it('listEstabelecimentos rejects invalid perfil', async () => {
    await expect(listEstabelecimentos({ perfil: 'INVALIDO' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('listEstabelecimentos supports status=all without status filter', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listEstabelecimentos({ status: 'all' });

    expect(query.mock.calls[0][0]).not.toMatch(/status =/);
  });

  it('listEstabelecimentos applies q search filter', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listEstabelecimentos({ q: 'UBS' });

    expect(query.mock.calls[0][0]).toMatch(/nome ILIKE/i);
  });

  it('listEstabelecimentos filters by perfil', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            codigo_externo: '1234567',
            nome: 'Hospital X',
            cnpj: null,
            re_tipo: 'H',
            tipouni: '3',
            perfil: 'Hospitalar',
            perfil_editado: false,
            area: 1,
            relatorio: null,
            status: 'ativo',
            sincronizado_em: '2026-06-20T12:00:00Z',
          },
        ],
      });

    const result = await listEstabelecimentos({ perfil: 'Hospitalar' });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].perfil).toBe('Hospitalar');
    expect(result.data[0].enrichment).toBeUndefined();
    expect(query.mock.calls[1][0]).toMatch(/perfil = \$1/);
    expect(query.mock.calls[1][1]).toContain('Hospitalar');
  });

  it('listEstabelecimentos filters by perfil=Misto', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 9,
            codigo_externo: '9999999',
            nome: 'Unidade Mista',
            cnpj: null,
            re_tipo: null,
            tipouni: null,
            perfil: 'Misto',
            perfil_editado: false,
            area: null,
            relatorio: null,
            status: 'ativo',
            sincronizado_em: null,
          },
        ],
      });

    const result = await listEstabelecimentos({ perfil: 'Misto' });

    expect(result.data[0].perfil).toBe('Misto');
    expect(query.mock.calls[1][1]).toContain('Misto');
  });

  it('updatePerfil rejects invalid perfil string', async () => {
    await expect(updatePerfil(1, 'INVALIDO')).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });

  it('updatePerfil sets perfil_editado=true in returned row', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ ...hospitalDetailRow, perfil_editado: true }] });

    const updated = await updatePerfil(1, 'MAC');

    expect(query.mock.calls[0][0]).toMatch(/perfil_editado = true/i);
    expect(updated.perfil_editado).toBe(true);
  });

  it('upsertEnrichment hospitalar rejects negative leitos', async () => {
    await expect(
      upsertEnrichment(1, 'hospitalar', { leitos: { clinico: -1 } })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('upsertEnrichment returns 403 when slug does not match perfil', async () => {
    mockTransactionalQuery((sql) => {
      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 1, perfil: 'Hospitalar', perfil_editado: false }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    await expect(
      upsertEnrichment(1, 'aps', { notas: 'x' })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('getEstabelecimentoById includes enrichment when hospitalar row exists', async () => {
    query.mockResolvedValueOnce({ rows: [hospitalDetailRow] });

    const detail = await getEstabelecimentoById(1);

    expect(detail.enrichment.leitos.clinico).toBe(10);
    expect(detail.perfil_editado).toBe(false);
  });

  it('rejects identity fields like nome on update', async () => {
    await expect(
      updateEnriquecimento(1, { nome: 'hack' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects enrichment for APS profile', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 2, perfil: 'APS', perfil_editado: false }],
    });

    await expect(
      updateEnriquecimento(2, { notas: 'teste' })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('mergeEnrichment clears empty fields', () => {
    expect(
      mergeEnrichment(
        { leitos: { clinico: 10 }, especialidades: ['Cardio'], notas: 'x' },
        { leitos: {}, especialidades: [], habilitacoes: [], notas: '' }
      )
    ).toEqual({});
  });

  it('mergeEnrichmentForSlug merges APS notes', () => {
    expect(
      mergeEnrichmentForSlug('aps', { notas: 'antes' }, { notas: 'depois' })
    ).toEqual({ notas: 'depois' });
  });

  it('mergeEnrichmentForSlug deep-merges partial leitos updates', () => {
    expect(
      mergeEnrichmentForSlug(
        'hospitalar',
        { leitos: { clinico: 10, uti: 2 } },
        { leitos: { clinico: 20 } }
      )
    ).toEqual({ leitos: { clinico: 20, uti: 2 } });
  });

  it('merges allowed enrichment fields into hospitalar table', async () => {
    mockTransactionalQuery((sql) => {
      if (sql.includes('LEFT JOIN')) {
        return Promise.resolve({
          rows: [
            {
              ...hospitalDetailRow,
              eh_leitos: { clinico: 10 },
              especialidades: [],
              habilitacoes: [],
              eh_notas: 'legado',
            },
          ],
        });
      }

      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({ rows: [hospitalCoreRow] });
      }

      if (sql.includes('FROM estabelecimentos') && sql.includes('WHERE id = $1')) {
        return Promise.resolve({ rows: [hospitalCoreRow] });
      }

      if (sql.includes('FROM enriquecimento_hospitalar')) {
        return Promise.resolve({
          rows: [{ leitos: {}, especialidades: [], habilitacoes: [], notas: 'legado' }],
        });
      }

      if (sql.includes('INSERT INTO enriquecimento_hospitalar')) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const updated = await updateEnriquecimento(1, { leitos: { clinico: 10 } });

    expect(updated.enrichment).toEqual({
      leitos: { clinico: 10 },
      especialidades: [],
      habilitacoes: [],
      notas: 'legado',
    });
    expect(query.mock.calls.some((call) => call[0].includes('INSERT INTO enriquecimento_hospitalar'))).toBe(true);
    expect(query.mock.calls.some((call) => call[0].includes('UPDATE estabelecimentos'))).toBe(false);
  });

  it('clears saved enrichment when empty form is submitted', async () => {
    mockTransactionalQuery((sql) => {
      if (sql.includes('LEFT JOIN')) {
        return Promise.resolve({
          rows: [
            {
              ...hospitalDetailRow,
              eh_leitos: {},
              especialidades: [],
              habilitacoes: [],
              eh_notas: null,
            },
          ],
        });
      }

      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({ rows: [hospitalCoreRow] });
      }

      if (sql.includes('FROM estabelecimentos') && sql.includes('WHERE id = $1')) {
        return Promise.resolve({ rows: [hospitalCoreRow] });
      }

      if (sql.includes('FROM enriquecimento_hospitalar')) {
        return Promise.resolve({
          rows: [{ leitos: { clinico: 10 }, especialidades: [], habilitacoes: [], notas: 'legado' }],
        });
      }

      if (sql.includes('INSERT INTO enriquecimento_hospitalar')) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const updated = await updateEnriquecimento(1, {
      leitos: {},
      especialidades: [],
      habilitacoes: [],
      notas: '',
    });

    expect(updated.enrichment).toEqual({
      leitos: {},
      especialidades: [],
      habilitacoes: [],
    });
  });

  it('upsertEnrichment rejects invalid slug', async () => {
    await expect(
      upsertEnrichment(1, 'invalido', { notas: 'x' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('updatePerfil returns 404 when establishment is missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(updatePerfil(404, 'APS')).rejects.toMatchObject({ status: 404 });
  });

  it('upsertEnrichment persists APS enrichment', async () => {
    mockTransactionalQuery((sql) => {
      if (sql.includes('LEFT JOIN')) {
        return Promise.resolve({
          rows: [
            {
              id: 3,
              codigo_externo: 'APS001',
              nome: 'UBS',
              perfil: 'APS',
              perfil_editado: false,
              notas_territorio: 'Zona leste',
              aps_notas: 'notas APS',
            },
          ],
        });
      }

      if (sql.includes('FOR UPDATE')) {
        return Promise.resolve({
          rows: [{ id: 3, perfil: 'APS', perfil_editado: false }],
        });
      }

      if (sql.includes('FROM enriquecimento_aps')) {
        return Promise.resolve({ rows: [] });
      }

      if (sql.includes('INSERT INTO enriquecimento_aps')) {
        return Promise.resolve({ rows: [] });
      }

      return Promise.resolve({ rows: [] });
    });

    const updated = await upsertEnrichment(3, 'aps', {
      notas_territorio: 'Zona leste',
      notas: 'notas APS',
    });

    expect(updated.enrichment.notas_territorio).toBe('Zona leste');
    expect(query.mock.calls.some((call) => call[0].includes('INSERT INTO enriquecimento_aps'))).toBe(true);
  });

  it('getEstabelecimentoById returns 404 when missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(getEstabelecimentoById(404)).rejects.toMatchObject({
      status: 404,
    });
  });
});
