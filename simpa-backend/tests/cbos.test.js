jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const { listCbos } = require('../src/services/cbosService');

describe('cbosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  it('listCbos searches by q in descricao and codigo_cbo', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            codigo_cbo: '225125',
            descricao: 'MEDICO CLINICO',
            status: 'ativo',
            sincronizado_em: '2026-06-20T12:00:00Z',
          },
        ],
      });

    const result = await listCbos({ q: 'MEDICO', page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].codigo_cbo).toBe('225125');
    expect(query.mock.calls[1][0]).toMatch(/descricao ILIKE/i);
    expect(query.mock.calls[1][0]).toMatch(/codigo_cbo ILIKE/i);
  });

  it('listCbos returns pagination totals', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 50 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listCbos({ page: 3, limit: 20 });

    expect(result.pagination).toEqual({
      page: 3,
      limit: 20,
      total: 50,
      pages: 3,
    });
    expect(query.mock.calls[1][1]).toEqual(['ativo', 20, 40]);
  });

  it('listCbos caps limit at 200', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listCbos({ limit: 999 });

    expect(result.pagination.limit).toBe(200);
    expect(query.mock.calls[1][1]).toEqual(['ativo', 200, 0]);
  });

  it('listCbos rejects invalid status', async () => {
    await expect(listCbos({ status: 'foo' })).rejects.toMatchObject({
      status: 400,
      message: 'status inválido',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('listCbos supports status=all without status filter', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listCbos({ status: 'all' });

    expect(query.mock.calls[0][0]).not.toMatch(/status =/);
  });
});
