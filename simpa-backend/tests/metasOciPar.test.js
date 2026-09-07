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

  // ── validation error branches ────────────────────────────────────────────────

  it('createMetaOciPar throws 400 when competencia is missing', async () => {
    await expect(createMetaOciPar({ tipo_oci: 'x', meta_quantidade: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/competencia/i) });
  });

  it('createMetaOciPar throws 400 when competencia format is wrong', async () => {
    await expect(createMetaOciPar({ competencia: '2026/01', tipo_oci: 'x', meta_quantidade: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/YYYY-MM/i) });
  });

  it('createMetaOciPar throws 400 when tipo_oci is empty', async () => {
    await expect(createMetaOciPar({ competencia: '2026-01', tipo_oci: '', meta_quantidade: 1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/tipo_oci/i) });
  });

  it('createMetaOciPar throws 400 when meta_quantidade is negative', async () => {
    await expect(createMetaOciPar({ competencia: '2026-01', tipo_oci: 'x', meta_quantidade: -1 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/meta_quantidade/i) });
  });

  it('createMetaOciPar throws 400 when periodicidade is invalid', async () => {
    await expect(createMetaOciPar({ competencia: '2026-01', tipo_oci: 'x', meta_quantidade: 0, periodicidade: 'diario' }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/periodicidade/i) });
  });

  it('createMetaOciPar throws 400 when meta_valor is invalid string', async () => {
    await expect(createMetaOciPar({ competencia: '2026-01', tipo_oci: 'x', meta_quantidade: 0, meta_valor: 'abc' }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/meta_valor/i) });
  });

  it('createMetaOciPar sets meta_valor null when empty string', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
    query.mockResolvedValueOnce({ rows: [{ id: 10, competencia: new Date('2026-01-01'), tipo_oci: 'x', meta_quantidade: 0, meta_valor: null, codigo_sigtap_prefix: null, periodicidade: 'mensal', origem: 'PAR-PMAE', status: 'ativo', estabelecimento_id: null }] });
    const row = await createMetaOciPar({ competencia: '2026-01', tipo_oci: 'x', meta_quantidade: 0, meta_valor: '' });
    expect(row.id).toBe(10);
  });

  it('createMetaOciPar accepts estabelecimento_id as positive int', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 11 }] });
    query.mockResolvedValueOnce({ rows: [{ id: 11, competencia: new Date('2026-01-01'), tipo_oci: 'x', meta_quantidade: 0, meta_valor: null, codigo_sigtap_prefix: null, periodicidade: 'mensal', origem: 'PAR-PMAE', status: 'ativo', estabelecimento_id: 5 }] });
    const row = await createMetaOciPar({ competencia: '2026-01', tipo_oci: 'x', meta_quantidade: 0, estabelecimento_id: 5 });
    expect(row.estabelecimento_id).toBe(5);
  });

  it('createMetaOciPar throws 400 when estabelecimento_id is invalid', async () => {
    await expect(createMetaOciPar({ competencia: '2026-01', tipo_oci: 'x', meta_quantidade: 0, estabelecimento_id: 'abc' }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/estabelecimento_id/i) });
  });

  it('listMetasOciPar without competencia returns all active', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 2, competencia: new Date('2026-03-01'), tipo_oci: 'nefro', meta_quantidade: 10, meta_valor: null, codigo_sigtap_prefix: null, periodicidade: 'mensal', origem: 'PAR-PMAE', status: 'ativo', estabelecimento_id: null }] });
    const rows = await listMetasOciPar({});
    expect(rows[0].competencia).toBe('2026-03');
  });

  it('listMetasOciPar filters by tipo_oci', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await listMetasOciPar({ tipo_oci: 'cardio' });
    expect(query.mock.calls[0][0]).toContain('ILIKE');
  });

  it('updateMetaOciPar returns existing when no fields change (empty partial payload)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 7, competencia: new Date('2026-01-01'), tipo_oci: 'x', meta_quantidade: 5, meta_valor: null, codigo_sigtap_prefix: null, periodicidade: 'mensal', origem: 'PAR-PMAE', status: 'ativo', estabelecimento_id: null }] });
    // no fields → getMetaOciParById is called directly
    const row = await updateMetaOciPar(7, {});
    expect(row.id).toBe(7);
  });

  it('updateMetaOciPar throws 404 when rowCount is 0', async () => {
    query.mockResolvedValueOnce({ rowCount: 0 });
    await expect(updateMetaOciPar(99, { tipo_oci: 'cardio' }))
      .rejects.toMatchObject({ status: 404 });
  });

  it('updateMetaOciPar throws 400 for invalid id', async () => {
    await expect(updateMetaOciPar('abc', { tipo_oci: 'x' }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/id/i) });
  });

  it('competencia as non-string throws 400', async () => {
    await expect(createMetaOciPar({ competencia: 12345, tipo_oci: 'x', meta_quantidade: 0 }))
      .rejects.toMatchObject({ status: 400, message: expect.stringMatching(/obrigatória/i) });
  });
});
