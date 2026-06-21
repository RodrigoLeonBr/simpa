jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const { listProducao } = require('../src/services/siaProducaoService');

describe('siaProducaoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
  });

  it('listProducao joins formas_sia and cbos_sia with canonical codes', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          codigo_sigtap: '0301010072',
          descricao: 'Consulta',
          faixa_etaria: '20-29',
          sexo: 'F',
          cbo: '225125',
          quantidade: '7',
          valor_aprovado: '100.00',
          descricao_forma: 'CONSULTA MEDICA',
          descricao_cbo: 'MEDICO CLINICO',
        },
      ],
    });

    const rows = await listProducao({
      competencia: '2026-05',
      unidade: 'CAFI',
      codigo_sigtap: '0301010072',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].descricao_forma).toBe('CONSULTA MEDICA');
    expect(rows[0].descricao_cbo).toBe('MEDICO CLINICO');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/FROM sia_producao sp/);
    expect(sql).toMatch(/LEFT JOIN formas_sia fs/);
    expect(sql).toMatch(/LEFT JOIN cbos_sia cs/);
    expect(sql).toMatch(/LEFT\(TRIM\(sp\.codigo_sigtap\), 6\)/);
    expect(sql).toMatch(/descricao_forma/);
    expect(sql).toMatch(/descricao_cbo/);
    expect(params).toEqual(['2026-05-01', '%CAFI%', '0301010072']);
  });

  it('listProducao preserves legacy aggregate fields', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          codigo_sigtap: '0301010072',
          descricao: 'Consulta',
          faixa_etaria: '20-29',
          sexo: 'F',
          cbo: '225125',
          quantidade: '7',
          valor_aprovado: '100.00',
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
      valor_aprovado: '100.00',
      descricao_forma: null,
      descricao_cbo: null,
    });
  });
});
