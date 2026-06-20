jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  listProcedimentos,
  getProcedimentoById,
} = require('../src/services/procedimentosService');

describe('procedimentosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  it('listProcedimentos searches by q and paginates', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 2,
            codigo_sigtap: '0301010010',
            descricao: 'CONSULTA MEDICA',
            tipo: 'ambulatorial',
            pa_total: 10,
            rubrica: '0101',
            pa_id: 'PA1',
            financiamento: 'MAC',
            fonte: 'mysql_sync',
            status: 'ativo',
            sincronizado_em: '2026-06-20T12:00:00Z',
          },
        ],
      });

    const result = await listProcedimentos({ q: 'CONSULTA', page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].codigo_sigtap).toBe('0301010010');
    expect(query.mock.calls[1][0]).toMatch(/descricao ILIKE/i);
  });

  it('listProcedimentos supports status=all', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    await listProcedimentos({ status: 'all' });

    expect(query.mock.calls[0][0]).not.toMatch(/status =/);
  });

  it('getProcedimentoById returns row', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          codigo_sigtap: '0301010010',
          descricao: 'CONSULTA',
          tipo: null,
          pa_total: null,
          rubrica: null,
          pa_id: null,
          financiamento: null,
          fonte: 'mysql_sync',
          status: 'ativo',
          sincronizado_em: null,
        },
      ],
    });

    const row = await getProcedimentoById(1);
    expect(row.codigo_sigtap).toBe('0301010010');
  });
});
