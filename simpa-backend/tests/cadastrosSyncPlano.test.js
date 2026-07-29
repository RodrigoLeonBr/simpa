jest.mock('../src/services/db', () => {
  const client = { query: jest.fn(), release: jest.fn() };
  return {
    query: jest.fn(),
    pool: { connect: jest.fn(async () => client) },
    __client: client,
  };
});

const db = require('../src/services/db');
const { parsePlanOutput, aplicarPlano } = require('../src/services/cadastrosSync');

describe('parsePlanOutput', () => {
  it('parseia JSON de plano', () => {
    const stdout = JSON.stringify({
      status: 'ok',
      estabelecimentos: [{ chave: '111', tipo: 'novo', diff: { nome: { mysql: 'UBS A' } } }],
      procedimentos: [],
      resumo: { estabelecimentos: { novo: 1, alterado: 0, sumiu: 0 }, procedimentos: { novo: 0, alterado: 0, sumiu: 0 } },
      sincronizado_em: '2026-07-28T12:00:00+00:00',
    });
    const plan = parsePlanOutput(stdout);
    expect(plan.estabelecimentos).toHaveLength(1);
    expect(plan.resumo.estabelecimentos.novo).toBe(1);
  });

  it('propaga status erro do python', () => {
    const stdout = JSON.stringify({ status: 'erro', error: 'PG down' });
    expect(() => parsePlanOutput(stdout)).toThrow('PG down');
  });

  it('lança 502 em stdout vazio', () => {
    let err;
    try { parsePlanOutput('   '); } catch (e) { err = e; }
    expect(err).toBeDefined();
    expect(err.status).toBe(502);
  });
});

describe('aplicarPlano', () => {
  beforeEach(() => {
    db.__client.query.mockReset();
    db.__client.release.mockReset();
    db.__client.query.mockResolvedValue({ rows: [], rowCount: 1 });
  });

  it('aplica alterado quando SIMPA atual bate com o diff.simpa', async () => {
    db.__client.query.mockImplementation(async (sql) => {
      if (/SELECT .* FROM estabelecimentos/i.test(sql)) return { rows: [{ status: 'ativo' }] };
      return { rows: [], rowCount: 1 };
    });
    const r = await aplicarPlano([
      { entidade: 'estabelecimento', chave: '111', tipo: 'alterado',
        diff: { status: { simpa: 'ativo', mysql: 'inativo' } } },
    ]);
    expect(r.aplicados).toBe(1);
    expect(r.pulados).toBe(0);
    const updateCall = db.__client.query.mock.calls.find(([s]) => /UPDATE estabelecimentos SET/i.test(s));
    expect(updateCall).toBeTruthy();
    expect(db.__client.query.mock.calls.some(([s]) => /BEGIN/.test(s))).toBe(true);
    expect(db.__client.query.mock.calls.some(([s]) => /COMMIT/.test(s))).toBe(true);
  });

  it('pula item quando SIMPA atual divergiu do diff.simpa (anti-clobber)', async () => {
    db.__client.query.mockImplementation(async (sql) => {
      if (/SELECT .* FROM estabelecimentos/i.test(sql)) return { rows: [{ status: 'inativo' }] };
      return { rows: [], rowCount: 1 };
    });
    const r = await aplicarPlano([
      { entidade: 'estabelecimento', chave: '111', tipo: 'alterado',
        diff: { status: { simpa: 'ativo', mysql: 'inativo' } } },
    ]);
    expect(r.aplicados).toBe(0);
    expect(r.pulados).toBe(1);
    expect(db.__client.query.mock.calls.some(([s]) => /UPDATE estabelecimentos SET/i.test(s))).toBe(false);
  });

  it('insere novo via INSERT ... ON CONFLICT DO NOTHING', async () => {
    const r = await aplicarPlano([
      { entidade: 'estabelecimento', chave: '999', tipo: 'novo',
        diff: { nome: { mysql: 'UBS NOVA' }, status: { mysql: 'ativo' } } },
    ]);
    expect(r.aplicados).toBe(1);
    const insertCall = db.__client.query.mock.calls.find(([s]) => /INSERT INTO estabelecimentos/i.test(s));
    expect(insertCall).toBeTruthy();
    expect(insertCall[0]).toMatch(/ON CONFLICT/i);
  });

  it('ignora chave de campo fora do allowlist no clobber (anti-injeção)', async () => {
    const capturado = [];
    db.__client.query.mockImplementation(async (sql) => {
      capturado.push(sql);
      if (/SELECT .* FROM estabelecimentos/i.test(sql)) return { rows: [{ status: 'ativo' }] };
      return { rows: [], rowCount: 1 };
    });
    await aplicarPlano([
      { entidade: 'estabelecimento', chave: '111', tipo: 'alterado',
        diff: {
          status: { simpa: 'ativo', mysql: 'inativo' },
          'evil; DROP TABLE estabelecimentos; --': { simpa: 'x', mysql: 'y' },
        } },
    ]);
    // nenhuma query pode conter o texto malicioso
    expect(capturado.some((s) => /DROP TABLE/i.test(s))).toBe(false);
    // o SELECT de clobber deve pedir só a coluna allowlistada `status`
    const sel = capturado.find((s) => /SELECT .* FROM estabelecimentos/i.test(s));
    expect(sel).toMatch(/SELECT status FROM/i);
  });

  it('não pula alterado quando SIMPA atual é number e diff.simpa é string equivalente', async () => {
    // node-pg pode devolver a coluna como number; o plano traz string -> não deve dar clobber falso
    db.__client.query.mockImplementation(async (sql) => {
      if (/SELECT .* FROM procedimentos/i.test(sql)) return { rows: [{ pa_total: 12.5 }] };
      return { rows: [], rowCount: 1 };
    });
    const r = await aplicarPlano([
      { entidade: 'procedimento', chave: '0301010010', tipo: 'alterado',
        diff: { pa_total: { simpa: '12.5', mysql: '13.0' } } },
    ]);
    expect(r.aplicados).toBe(1);
    expect(r.pulados).toBe(0);
  });

  it('faz ROLLBACK se uma query falha', async () => {
    db.__client.query.mockImplementation(async (sql) => {
      if (/UPDATE estabelecimentos SET/i.test(sql)) throw new Error('db boom');
      if (/SELECT .* FROM estabelecimentos/i.test(sql)) return { rows: [{ status: 'ativo' }] };
      return { rows: [], rowCount: 1 };
    });
    await expect(aplicarPlano([
      { entidade: 'estabelecimento', chave: '111', tipo: 'alterado',
        diff: { status: { simpa: 'ativo', mysql: 'inativo' } } },
    ])).rejects.toThrow('db boom');
    expect(db.__client.query.mock.calls.some(([s]) => /ROLLBACK/.test(s))).toBe(true);
    expect(db.__client.release).toHaveBeenCalled();
  });
});
