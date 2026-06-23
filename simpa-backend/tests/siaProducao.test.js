jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  listProducao,
  __resetSiaProducaoColumnsCache,
} = require('../src/services/siaProducaoService');

describe('siaProducaoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
    __resetSiaProducaoColumnsCache();
  });

  it('listProducao joins formas_sia and cbos_sia with canonical codes', async () => {
    query.mockResolvedValueOnce({
      rows: [{ column_name: 'quantidade_apresentada' }, { column_name: 'valor_apresentado' }],
    });
    query.mockResolvedValueOnce({
      rows: [
        {
          codigo_sigtap: '0301010072',
          descricao: 'Consulta',
          faixa_etaria: '20-29',
          sexo: 'F',
          cbo: '225125',
          quantidade: '7',
          quantidade_apresentada: '9',
          valor_aprovado: '100.00',
          valor_apresentado: '120.00',
          descricao_forma: 'CONSULTA MEDICA',
          descricao_cbo: 'MEDICO CLINICO',
        },
      ],
    });

    const rows = await listProducao({
      competencia: '2026-05',
      unidade: 'CAFI',
      codigo_sigtap: '0301010072',
      estabelecimento_id: '42',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].descricao_forma).toBe('CONSULTA MEDICA');
    expect(rows[0].descricao_cbo).toBe('MEDICO CLINICO');

    const [sql, params] = query.mock.calls[1];
    expect(sql).toMatch(/FROM sia_producao sp/);
    expect(sql).toMatch(/LEFT JOIN formas_sia fs/);
    expect(sql).toMatch(/LEFT JOIN cbos_sia cs/);
    expect(sql).toMatch(/LEFT\(TRIM\(sp\.codigo_sigtap\), 6\)/);
    expect(sql).toMatch(/descricao_forma/);
    expect(sql).toMatch(/descricao_cbo/);
    expect(sql).toMatch(/quantidade_apresentada/);
    expect(sql).toMatch(/valor_apresentado/);
    expect(sql).toMatch(/sp\.estabelecimento_id = \$4/);
    expect(params).toEqual(['2026-05-01', '%CAFI%', '0301010072', '42']);
  });

  it('listProducao preserves legacy aggregate fields', async () => {
    query.mockResolvedValueOnce({
      rows: [{ column_name: 'quantidade_apresentada' }, { column_name: 'valor_apresentado' }],
    });
    query.mockResolvedValueOnce({
      rows: [
        {
          codigo_sigtap: '0301010072',
          descricao: 'Consulta',
          faixa_etaria: '20-29',
          sexo: 'F',
          cbo: '225125',
          quantidade: '7',
          quantidade_apresentada: '8',
          valor_aprovado: '100.00',
          valor_apresentado: '130.00',
          descricao_forma: null,
          descricao_cbo: null,
        },
      ],
    });

    const rows = await listProducao({});

    expect(rows[0]).toMatchObject({
      codigo_sigtap: '0301010072',
      descricao: 'Consulta',
      faixa_etaria: '20-29',
      sexo: 'F',
      cbo: '225125',
      quantidade: '7',
      quantidade_apresentada: '8',
      valor_aprovado: '100.00',
      valor_apresentado: '130.00',
      descricao_forma: null,
      descricao_cbo: null,
    });
  });

  it('listProducao falls back when apresentado columns are absent', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({
      rows: [
        {
          codigo_sigtap: '0301010072',
          quantidade: '5',
          quantidade_apresentada: '0',
          valor_aprovado: '90.00',
          valor_apresentado: '0',
          descricao_forma: null,
          descricao_cbo: null,
        },
      ],
    });

    const rows = await listProducao({ competencia: '2026-05' });

    const [sql] = query.mock.calls[1];
    expect(sql).toMatch(/SUM\(0\)::bigint AS quantidade_apresentada/);
    expect(sql).toMatch(/SUM\(0\)::numeric AS valor_apresentado/);
    expect(rows[0].quantidade_apresentada).toBe('0');
    expect(rows[0].valor_apresentado).toBe('0');
  });
});
