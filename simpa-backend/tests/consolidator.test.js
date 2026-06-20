const { EventEmitter } = require('events');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');
const { runConsolidation } = require('../src/services/consolidator');

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

describe('consolidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses JSON stdout on success', async () => {
    mockSpawn({ stdout: '{"status":"ok"}' });

    const result = await runConsolidation({
      competencia: '2026-05',
      unidade: 'U',
      equipe: 'E',
    });

    expect(result).toEqual({ ok: true, result: { status: 'ok' } });
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--pg-write', '--competencia', '2026-05']),
      expect.any(Object)
    );
  });

  it('returns ok when stdout is empty', async () => {
    mockSpawn({ stdout: '' });

    const result = await runConsolidation({ all: true });
    expect(result).toEqual({ ok: true, result: null });
  });

  it('rejects invalid JSON stdout', async () => {
    mockSpawn({ stdout: 'not-json' });

    await expect(runConsolidation({ all: true })).rejects.toMatchObject({
      status: 502,
      message: /JSON inválida/i,
    });
  });

  it('rejects non-zero exit code', async () => {
    mockSpawn({ code: 1, stderr: 'Erro: grupo inválido' });

    await expect(
      runConsolidation({ competencia: '2026-05', unidade: 'U', equipe: 'E' })
    ).rejects.toMatchObject({ status: 502, message: /grupo inválido/i });
  });
});
