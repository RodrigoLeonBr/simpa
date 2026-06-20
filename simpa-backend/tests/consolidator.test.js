const { EventEmitter } = require('events');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');
const { runConsolidation, buildConsolidationArgs } = require('../src/services/consolidator');

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

  it('buildConsolidationArgs uses legacy unidade/equipe by default', () => {
    const args = buildConsolidationArgs({
      competencia: '2026-05',
      unidade: 'U',
      equipe: 'E',
    });

    expect(args).toEqual(
      expect.arrayContaining([
        '--pg-write',
        '--competencia',
        '2026-05',
        '--unidade',
        'U',
        '--equipe',
        'E',
      ])
    );
    expect(args).not.toContain('--estabelecimento-id');
  });

  it('buildConsolidationArgs supports --all without filters', () => {
    const args = buildConsolidationArgs({ all: true });
    expect(args).toEqual(expect.arrayContaining(['--pg-write', '--all']));
    expect(args).not.toContain('--competencia');
  });

  it('buildConsolidationArgs forwards cadastro IDs', () => {
    const args = buildConsolidationArgs({
      competencia: '2026-05',
      estabelecimentoId: 42,
      equipeId: 7,
    });

    expect(args).toEqual(
      expect.arrayContaining([
        '--competencia',
        '2026-05',
        '--estabelecimento-id',
        '42',
        '--equipe-id',
        '7',
      ])
    );
    expect(args).not.toContain('--unidade');
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

  it('forwards cadastro IDs to Python spawn', async () => {
    mockSpawn({ stdout: '{"status":"ok"}' });

    await runConsolidation({
      competencia: '2026-05',
      estabelecimentoId: 42,
      equipeId: 7,
    });

    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        '--estabelecimento-id',
        '42',
        '--equipe-id',
        '7',
      ]),
      expect.any(Object)
    );
  });

  it('rejects non-zero exit code', async () => {
    mockSpawn({ code: 1, stderr: 'Erro: grupo inválido' });

    await expect(
      runConsolidation({ competencia: '2026-05', unidade: 'U', equipe: 'E' })
    ).rejects.toMatchObject({ status: 502, message: /grupo inválido/i });
  });

  it('rejects spawn process errors', async () => {
    const proc = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();

    spawn.mockImplementationOnce(() => {
      process.nextTick(() => proc.emit('error', new Error('spawn failed')));
      return proc;
    });

    await expect(runConsolidation({ all: true })).rejects.toThrow('spawn failed');
  });

  it('uses exit code fallback when stderr is empty', async () => {
    mockSpawn({ code: 3, stderr: '' });

    await expect(runConsolidation({ all: true })).rejects.toMatchObject({
      status: 502,
      message: /exit 3/i,
    });
  });
});
