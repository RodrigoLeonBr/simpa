const { query } = require('../src/services/db');
const {
  listMetasOciPar,
  createMetaOciPar,
  updateMetaOciPar,
  inactivateMetaOciPar,
} = require('../src/services/metasOciParService');

jest.mock('../src/services/db', () => ({
  query: jest.fn(),
}));

describe('metasOciParService', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('listMetasOciPar filtra por competencia', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, competencia: new Date('2026-01-01') }] });

    const rows = await listMetasOciPar({ competencia: '2026-01' });

    expect(query.mock.calls[0][0]).toContain('FROM metas_oci_par');
    expect(query.mock.calls[0][1]).toEqual(['2026-01-01']);
    expect(rows[0].competencia).toBe('2026-01');
  });

  it('createMetaOciPar insere meta mensal', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 9 }] });
    query.mockResolvedValueOnce({
      rows: [{
        id: 9,
        competencia: new Date('2026-02-01'),
        tipo_oci: 'cardiologia',
        estabelecimento_id: null,
        meta_quantidade: 50,
        meta_valor: null,
        codigo_sigtap_prefix: '0303',
        periodicidade: 'mensal',
        origem: 'PAR-PMAE',
        status: 'ativo',
      }],
    });

    const row = await createMetaOciPar({
      competencia: '2026-02',
      tipo_oci: 'cardiologia',
      meta_quantidade: 50,
      codigo_sigtap_prefix: '0303',
    });

    expect(row.id).toBe(9);
    expect(row.tipo_oci).toBe('cardiologia');
  });

  it('inactivateMetaOciPar retorna 404 quando ausente', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 });

    await expect(inactivateMetaOciPar(404)).rejects.toMatchObject({ status: 404 });
  });

  it('updateMetaOciPar atualiza meta_quantidade', async () => {
    query.mockResolvedValueOnce({ rowCount: 1 });
    query.mockResolvedValueOnce({
      rows: [{
        id: 3,
        competencia: new Date('2026-01-01'),
        tipo_oci: 'oncologia',
        estabelecimento_id: null,
        meta_quantidade: 99,
        meta_valor: null,
        codigo_sigtap_prefix: '0303',
        periodicidade: 'mensal',
        origem: 'PAR-PMAE',
        status: 'ativo',
      }],
    });

    const row = await updateMetaOciPar(3, { meta_quantidade: 99 });
    expect(row.meta_quantidade).toBe(99);
  });
});
