'use strict';

jest.mock('../src/services/db');

const { query } = require('../src/services/db');
const {
  listCompetencias,
  exportProducao,
  discoverEsusSigtapFromBlocks,
} = require('../src/services/producaoSigtapService');

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

  it('lê da view unificada, agrega por SIGTAP e filtra por competência', async () => {
    await exportProducao('2026-05');
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/FROM v_esus_producao_sigtap/);
    expect(sql).toMatch(/SUM\(vs\.quantidade\)/);
    expect(sql).toMatch(/HAVING SUM/);
    expect(sql).toMatch(/est\.codigo_externo\s+AS cnes/);
    expect(params[0]).toBe('2026-05');
  });

  it('não usa mais UNION nem regexp em tempo de query (join único)', async () => {
    await exportProducao('2026-05');
    const [sql] = query.mock.calls[0];
    expect(sql).not.toMatch(/UNION ALL/);
    expect(sql).not.toMatch(/regexp_replace/);
  });
});

describe('discoverEsusSigtapFromBlocks', () => {
  it('upserta blocos SIGTAP como origem=descoberto, idempotente', async () => {
    query.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
    const out = await discoverEsusSigtapFromBlocks();
    const [sql] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO procedimentos_esus_sigtap/);
    expect(sql).toMatch(/ILIKE '%SIGTAP%'/);
    expect(sql).toMatch(/\\d\{10\}/);
    expect(sql).toMatch(/'descoberto'/);
    expect(sql).toMatch(/ON CONFLICT \(tipo_relatorio, descricao_esus\) DO NOTHING/);
    expect(out).toEqual({ inserted: 2 });
  });
});

describe('listCompetencias', () => {
  it('retorna array de competencias YYYY-MM', async () => {
    query.mockResolvedValue({ rows: [{ competencia: '2026-06' }, { competencia: '2026-05' }] });
    const out = await listCompetencias();
    expect(out).toEqual(['2026-06', '2026-05']);
  });
});
