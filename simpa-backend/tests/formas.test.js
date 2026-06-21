jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const { listFormas } = require('../src/services/formasService');

describe('formasService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  it('listFormas searches by q in descricao and codigo_forma', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            codigo_grupo: '03',
            codigo_subgrupo: '0301',
            codigo_forma: '030101',
            descricao: 'CONSULTA MEDICA',
            status: 'ativo',
            sincronizado_em: '2026-06-20T12:00:00Z',
          },
        ],
      });

    const result = await listFormas({ q: 'CONSULTA', page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].codigo_forma).toBe('030101');
    expect(query.mock.calls[1][0]).toMatch(/descricao ILIKE/i);
    expect(query.mock.calls[1][0]).toMatch(/codigo_forma ILIKE/i);
  });

  it('listFormas filters by grupo and subgrupo', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listFormas({ grupo: '03', subgrupo: '0301' });

    expect(query.mock.calls[0][0]).toMatch(/codigo_grupo = \$2/);
    expect(query.mock.calls[0][0]).toMatch(/codigo_subgrupo = \$3/);
    expect(query.mock.calls[0][1].slice(0, 3)).toEqual(['ativo', '03', '0301']);
  });

  it('listFormas returns pagination totals', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 25 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listFormas({ page: 2, limit: 10 });

    expect(result.pagination).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      pages: 3,
    });
    expect(query.mock.calls[1][1]).toEqual(['ativo', 10, 10]);
  });

  it('listFormas caps limit at 200', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listFormas({ limit: 500 });

    expect(result.pagination.limit).toBe(200);
    expect(query.mock.calls[1][1]).toEqual(['ativo', 200, 0]);
  });

  it('listFormas rejects invalid grupo', async () => {
    await expect(listFormas({ grupo: '030' })).rejects.toMatchObject({
      status: 400,
      message: 'grupo inválido',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('listFormas rejects invalid subgrupo', async () => {
    await expect(listFormas({ subgrupo: '03' })).rejects.toMatchObject({
      status: 400,
      message: 'subgrupo inválido',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('listFormas rejects invalid status', async () => {
    await expect(listFormas({ status: 'desconhecido' })).rejects.toMatchObject({
      status: 400,
      message: 'status inválido',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('listFormas supports status=all without status filter', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listFormas({ status: 'all' });

    expect(query.mock.calls[0][0]).not.toMatch(/status =/);
  });
});
