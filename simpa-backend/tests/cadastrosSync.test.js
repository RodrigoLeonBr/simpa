const { EventEmitter } = require('events');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('../src/services/db');

const { spawn } = require('child_process');
const { query } = require('../src/services/db');
const {
  sincronizar,
  parseSyncOutput,
  listSyncHistory,
  getLatestSync,
  mapSyncRow,
  _resetSyncLockForTests,
} = require('../src/services/cadastrosSync');

function mockSpawn({ code = 0, stdout = '', stderr = '' } = {}) {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  spawn.mockImplementationOnce(() => {
    process.nextTick(() => {
      if (stdout) proc.stdout.emit('data', Buffer.from(stdout));
      if (stderr) proc.stderr.emit('data', Buffer.from(stderr));
      proc.emit('close', code);
    });
    return proc;
  });
}

describe('cadastrosSync service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetSyncLockForTests();
  });

  it('parseSyncOutput unwraps single-item arrays', () => {
    expect(
      parseSyncOutput(
        JSON.stringify([{ status: 'ok', estabelecimentos: { inserted: 1 } }])
      )
    ).toEqual({ status: 'ok', estabelecimentos: { inserted: 1 } });
  });

  it('parseSyncOutput returns null for empty stdout', () => {
    expect(parseSyncOutput('')).toBeNull();
    expect(parseSyncOutput('   ')).toBeNull();
  });

  it('parseSyncOutput accepts plain object JSON', () => {
    const payload = {
      status: 'ok',
      estabelecimentos: { inserted: 2, updated: 3, inactivated: 0 },
      procedimentos: { inserted: 10, updated: 0, inactivated: 0 },
      sincronizado_em: '2026-06-20T12:00:00Z',
    };
    expect(parseSyncOutput(JSON.stringify(payload))).toEqual(payload);
  });

  it('parseSyncOutput keeps multi-item arrays intact', () => {
    const payload = [
      { status: 'ok', id: 1 },
      { status: 'parcial', id: 2 },
    ];
    expect(parseSyncOutput(JSON.stringify(payload))).toEqual(payload);
  });

  it('mapSyncRow returns null for falsy input', () => {
    expect(mapSyncRow(null)).toBeNull();
    expect(mapSyncRow(undefined)).toBeNull();
  });

  it('sincronizar parses JSON stdout on success', async () => {
    mockSpawn({
      stdout: JSON.stringify({
        status: 'ok',
        estabelecimentos: { inserted: 1, updated: 2, inactivated: 0 },
        procedimentos: { inserted: 5, updated: 0, inactivated: 0 },
        sincronizado_em: '2026-06-20T12:00:00Z',
      }),
    });

    const result = await sincronizar();

    expect(result.status).toBe('ok');
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--pg-write']),
      expect.any(Object)
    );
  });

  it('sincronizar parses structured erro JSON on non-zero exit', async () => {
    mockSpawn({
      code: 1,
      stdout: JSON.stringify({
        status: 'erro',
        error: 'MySQL_XAMPP_UNAVAILABLE',
        estabelecimentos: { inserted: 0, updated: 0, inactivated: 0 },
        procedimentos: { inserted: 0, updated: 0, inactivated: 0 },
      }),
    });

    const result = await sincronizar();

    expect(result.status).toBe('erro');
    expect(result.error).toBe('MySQL_XAMPP_UNAVAILABLE');
  });

  it('maps non-zero exit without JSON to 502 with stderr snippet', async () => {
    mockSpawn({ code: 1, stderr: 'unexpected crash' });

    await expect(sincronizar()).rejects.toMatchObject({
      status: 502,
      message: /unexpected crash/,
      details: 'unexpected crash',
    });
  });

  it('rejects concurrent sync with 409', async () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();

    spawn.mockImplementationOnce(() => {
      process.nextTick(() => {
        proc.stdout.emit(
          'data',
          Buffer.from(
            JSON.stringify({
              status: 'ok',
              estabelecimentos: { inserted: 0, updated: 0, inactivated: 0 },
              procedimentos: { inserted: 0, updated: 0, inactivated: 0 },
              sincronizado_em: '2026-06-20T12:00:00Z',
            })
          )
        );
        setTimeout(() => proc.emit('close', 0), 50);
      });
      return proc;
    });

    const first = sincronizar();
    await expect(sincronizar()).rejects.toMatchObject({
      status: 409,
      message: /já em andamento/i,
    });
    await first;
  });

  it('rejects empty stdout', async () => {
    mockSpawn({ stdout: '' });

    await expect(sincronizar()).rejects.toMatchObject({
      status: 502,
      message: /vazia/i,
    });
  });

  it('mapSyncRow normalizes DB columns', () => {
    expect(
      mapSyncRow({
        id: 7,
        status: 'ok',
        estab_inseridos: 1,
        estab_atualizados: 2,
        estab_inativados: 0,
        proc_inseridos: 3,
        proc_atualizados: 4,
        proc_inativados: 0,
        erro: null,
        sincronizado_em: '2026-06-20T12:00:00Z',
      })
    ).toEqual({
      id: 7,
      status: 'ok',
      sincronizado_em: '2026-06-20T12:00:00Z',
      erro: null,
      estabelecimentos: { inserted: 1, updated: 2, inactivated: 0 },
      procedimentos: { inserted: 3, updated: 4, inactivated: 0 },
    });
  });

  it('listSyncHistory returns paginated rows', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            status: 'ok',
            estab_inseridos: 1,
            estab_atualizados: 0,
            estab_inativados: 0,
            proc_inseridos: 2,
            proc_atualizados: 0,
            proc_inativados: 0,
            erro: null,
            sincronizado_em: '2026-06-20T12:00:00Z',
          },
        ],
      });

    const result = await listSyncHistory({ page: 1, limit: 10 });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(result.data[0].estabelecimentos.inserted).toBe(1);
  });

  it('getLatestSync returns most recent ok row', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 2,
          status: 'ok',
          estab_inseridos: 0,
          estab_atualizados: 5,
          estab_inativados: 0,
          proc_inseridos: 0,
          proc_atualizados: 10,
          proc_inativados: 0,
          erro: null,
          sincronizado_em: '2026-06-21T08:00:00Z',
        },
      ],
    });

    const latest = await getLatestSync();
    expect(latest.id).toBe(2);
    expect(latest.procedimentos.updated).toBe(10);
  });

  it('getLatestSync throws 404 when empty', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(getLatestSync()).rejects.toMatchObject({ status: 404 });
  });

  it('rejects spawn process errors', async () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();

    spawn.mockImplementationOnce(() => {
      process.nextTick(() => proc.emit('error', new Error('spawn failed')));
      return proc;
    });

    await expect(sincronizar()).rejects.toThrow('spawn failed');
  });

  it('rejects invalid JSON stdout on zero exit', async () => {
    mockSpawn({ stdout: 'not-json' });

    await expect(sincronizar()).rejects.toMatchObject({
      status: 502,
    });
  });

  it('rejects on subprocess timeout', async () => {
    jest.useFakeTimers();
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = jest.fn();

    spawn.mockImplementationOnce(() => proc);

    const promise = sincronizar();
    jest.advanceTimersByTime(301000);

    await expect(promise).rejects.toMatchObject({
      status: 504,
      message: /Timeout/i,
    });
    expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
    jest.useRealTimers();
  });

  it('listSyncHistory clamps pagination bounds', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listSyncHistory({ page: 0, limit: 999 });

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(100);
  });
});
