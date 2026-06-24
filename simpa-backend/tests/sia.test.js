const { EventEmitter } = require('events');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');
const { sincronizar, parseSyncOutput, getSyncProgress } = require('../src/services/sia');

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

describe('sia service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parseSyncOutput unwraps single-item arrays', () => {
    expect(parseSyncOutput('[{"status":"ok","registros":3}]')).toEqual({
      status: 'ok',
      registros: 3,
    });
  });

  it('parseSyncOutput keeps multi-item arrays intact', () => {
    const payload = [
      { status: 'ok', registros: 1 },
      { status: 'parcial', registros: 0 },
    ];
    expect(parseSyncOutput(JSON.stringify(payload))).toEqual(payload);
  });

  it('parseSyncOutput accepts plain object JSON', () => {
    expect(parseSyncOutput('{"status":"ok","registros":5}')).toEqual({
      status: 'ok',
      registros: 5,
    });
  });

  it('parses JSON stdout on success', async () => {
    mockSpawn({
      stdout: JSON.stringify([
        {
          sincronizacao_id: 1,
          competencia: '2026-05-01',
          registros: 10,
          erros: 0,
          status: 'ok',
        },
      ]),
    });

    const result = await sincronizar('2026-05');

    expect(result).toEqual(
      expect.objectContaining({ status: 'ok', registros: 10 })
    );
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--competencia', '2026-05', '--pg-write']),
      expect.any(Object)
    );
  });

  it('adds --reimportar when requested', async () => {
    mockSpawn({
      stdout: JSON.stringify([
        {
          sincronizacao_id: 2,
          competencia: '2026-05-01',
          registros: 11,
          erros: 0,
          status: 'ok',
        },
      ]),
    });

    await sincronizar('2026-05', { reimportar: true });

    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--competencia', '2026-05', '--pg-write', '--reimportar']),
      expect.any(Object)
    );
  });

  it('adds --exec-id and stores progress updates when requested', async () => {
    const execId = 'sync_2026_05_track1';
    mockSpawn({
      stderr: `SIA_PROGRESS {"stage":"extracao_mysql","event":"extract_block","block_rows":1200}\n`,
      stdout: JSON.stringify([
        {
          sincronizacao_id: 2,
          competencia: '2026-05-01',
          registros: 11,
          erros: 0,
          status: 'ok',
        },
      ]),
    });

    await sincronizar('2026-05', { executionId: execId });

    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--exec-id', execId]),
      expect.any(Object)
    );
    const progress = getSyncProgress(execId);
    expect(progress).toBeTruthy();
    expect(progress.status).toBe('done');
    expect(progress.events.some((evt) => evt.event === 'extract_block')).toBe(true);
  });

  it('handles subprocess failure gracefully', async () => {
    mockSpawn({ code: 1, stderr: 'MySQL connection refused' });

    await expect(sincronizar('2026-05')).rejects.toMatchObject({
      status: 502,
      message: /connection refused/i,
    });
  });

  it('rejects empty stdout', async () => {
    mockSpawn({ stdout: '' });

    await expect(sincronizar('2026-05')).rejects.toMatchObject({
      status: 502,
      message: /vazia/i,
    });
  });

  it('rejects invalid JSON stdout', async () => {
    mockSpawn({ stdout: 'not-json' });

    await expect(sincronizar('2026-05')).rejects.toMatchObject({
      status: 502,
      message: /JSON inválida/i,
    });
  });

  it('rejects spawn process errors', async () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();

    spawn.mockImplementationOnce(() => {
      process.nextTick(() => proc.emit('error', new Error('spawn failed')));
      return proc;
    });

    await expect(sincronizar('2026-05')).rejects.toThrow('spawn failed');
  });

  it('uses stderr fallback when subprocess exits non-zero without message', async () => {
    mockSpawn({ code: 2, stderr: '' });

    await expect(sincronizar('2026-05')).rejects.toMatchObject({
      status: 502,
      message: /exit 2/i,
    });
  });
});
