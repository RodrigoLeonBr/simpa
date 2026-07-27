'use strict';

jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const { listCompetencias, exportProducao } = require('../src/services/producaoSigtapService');

beforeEach(() => {
  jest.clearAllMocks();
  query.mockResolvedValue({ rows: [] });
});

describe('exportProducao', () => {
  it('rejeita competencia inválida com status 400', async () => {
    await expect(exportProducao('2026/05')).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejeita competencia ausente', async () => {
    await expect(exportProducao(undefined)).rejects.toMatchObject({ status: 400 });
  });

  it('join de-para + filtro por competência (YYYY-MM → date) e status ativo', async () => {
    await exportProducao('2026-05');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/JOIN procedimentos_esus_sigtap/);
    expect(sql).toMatch(/m\.status = 'ativo'/);
    expect(sql).toMatch(/HAVING SUM/);
    expect(params[0]).toBe('2026-05');
  });
});

describe('listCompetencias', () => {
  it('retorna array de competencias YYYY-MM', async () => {
    query.mockResolvedValue({ rows: [{ competencia: '2026-06' }, { competencia: '2026-05' }] });
    const out = await listCompetencias();
    expect(out).toEqual(['2026-06', '2026-05']);
  });
});
