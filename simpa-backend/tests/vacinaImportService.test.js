jest.mock('../src/services/db', () => ({
  pool: { connect: jest.fn() },
  query: jest.fn(),
}));

const { EventEmitter } = require('events');

// ponytail: mock child_process at module level so the captured spawn ref is replaced
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');
const db = require('../src/services/db');
const { gravarCarga, analisarPreview, parseUpload } = require('../src/services/vacinaImportService');

const makeParsed = (overrides = {}) => ({
  competencia: '2026-01-01',
  doses_total: 3,
  arquivo_nome: 'x.xlsx',
  linhas: [
    {
      cnes_sala: '1',
      sala_nome: 'A',
      imuno_codigo: '93',
      imuno_nome: 'HPV',
      faixa_nies: '05 a 11 anos',
      sistema_origem: 'NOVO PNI',
      doses: 3,
    },
  ],
  ...overrides,
});

describe('vacinaImportService.gravarCarga', () => {
  beforeEach(() => jest.clearAllMocks());

  it('substitui carga existente da mesma competência (sem dupla contagem) e retorna carga_id', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})                     // BEGIN
      .mockResolvedValueOnce({})                     // DELETE carga anterior
      .mockResolvedValueOnce({ rows: [{ id: 7 }] }) // INSERT carga RETURNING id
      .mockResolvedValue({});                        // demais inserts + COMMIT

    const res = await gravarCarga(makeParsed(), 'user@x');

    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /DELETE FROM vacina_cargas/i.test(s))).toBe(true);
    expect(sqls.some((s) => /COMMIT/i.test(s))).toBe(true);
    expect(client.release).toHaveBeenCalled();
    expect(res.carga_id).toBe(7);
    expect(res.competencia).toBe('2026-01-01');
    expect(res.linhas).toBe(1);
  });

  it('faz ROLLBACK e propaga erro se um insert falha', async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})                     // BEGIN
      .mockResolvedValueOnce({})                     // DELETE
      .mockResolvedValueOnce({ rows: [{ id: 9 }] }) // INSERT carga
      .mockRejectedValueOnce(new Error('boom'));     // primeiro insert de dose falha

    const parsed = makeParsed({
      doses_total: 1,
      linhas: [
        {
          cnes_sala: '1',
          sala_nome: 'A',
          imuno_codigo: '9',
          imuno_nome: 'V',
          faixa_nies: '01 ano',
          sistema_origem: 'X',
          doses: 1,
        },
      ],
    });

    await expect(gravarCarga(parsed, null)).rejects.toThrow('boom');

    const sqls = client.query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /ROLLBACK/i.test(s))).toBe(true);
    expect(client.release).toHaveBeenCalled();
  });
});

describe('vacinaImportService.analisarPreview', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retorna faixas_nao_mapeadas com as que não estão em vacina_faixa_grupo', async () => {
    db.query.mockResolvedValue({
      rows: [{ faixa_nies: '05 a 11 anos' }, { faixa_nies: '<1 ano' }],
    });

    const parsed = makeParsed({
      linhas: [
        { ...makeParsed().linhas[0], faixa_nies: '05 a 11 anos' },
        { ...makeParsed().linhas[0], faixa_nies: 'desconhecida' },
      ],
    });

    const res = await analisarPreview(parsed);
    expect(res.faixas_nao_mapeadas).toEqual(['desconhecida']);
    expect(res.competencia).toBe('2026-01-01');
    expect(res.linhas).toBe(2);
  });

  it('retorna lista vazia quando todas as faixas estão mapeadas', async () => {
    db.query.mockResolvedValue({ rows: [{ faixa_nies: '05 a 11 anos' }] });
    const res = await analisarPreview(makeParsed());
    expect(res.faixas_nao_mapeadas).toEqual([]);
  });
});

// ── parseUpload branches ──────────────────────────────────────────────────────

function makeProc() {
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  const proc = new EventEmitter();
  proc.stdout = stdout;
  proc.stderr = stderr;
  return proc;
}

describe('vacinaImportService.parseUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves with parsed JSON on exit code 0', async () => {
    const proc = makeProc();
    spawn.mockReturnValue(proc);

    const payload = { competencia: '2026-01-01', doses_total: 1, arquivo_nome: 'x.xlsx', linhas: [] };
    const p = parseUpload('/tmp/x.xlsx');

    proc.stdout.emit('data', JSON.stringify(payload));
    proc.emit('close', 0);

    await expect(p).resolves.toEqual(payload);
  });

  it('rejects with status 422 on non-zero exit code', async () => {
    const proc = makeProc();
    spawn.mockReturnValue(proc);

    const p = parseUpload('/tmp/x.xlsx');
    proc.stderr.emit('data', 'parse error detail');
    proc.emit('close', 1);

    const err = await p.catch((e) => e);
    expect(err.status).toBe(422);
    expect(err.message).toMatch(/parse error detail/);
  });

  it('rejects with status 502 on invalid JSON output when exit code 0', async () => {
    const proc = makeProc();
    spawn.mockReturnValue(proc);

    const p = parseUpload('/tmp/x.xlsx');
    proc.stdout.emit('data', 'not-json');
    proc.emit('close', 0);

    const err = await p.catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).toMatch(/JSON inválida/);
  });

  it('rejects on spawn error event', async () => {
    const proc = makeProc();
    spawn.mockReturnValue(proc);

    const p = parseUpload('/tmp/x.xlsx');
    proc.emit('error', new Error('spawn ENOENT'));

    await expect(p).rejects.toThrow('spawn ENOENT');
  });

  it('uses fallback message when stderr is empty on non-zero exit', async () => {
    const proc = makeProc();
    spawn.mockReturnValue(proc);

    const p = parseUpload('/tmp/x.xlsx');
    // no stderr data emitted → stderr stays empty string
    proc.emit('close', 2);

    const err = await p.catch((e) => e);
    expect(err.status).toBe(422);
    expect(err.message).toMatch(/parse_vacina_xlsx exit 2/);
  });
});

