const { EventEmitter } = require('events');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');
const { preview, processar, buildParserArgs } = require('../src/services/parser');

function mockSpawn({ code = 0, stdout = '[]', stderr = '' } = {}) {
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

describe('parser service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('buildParserArgs omits ID flags when options empty', () => {
    const args = buildParserArgs('/tmp/sample.csv', '--json-out');
    expect(args).toEqual(expect.arrayContaining(['/tmp/sample.csv', '--json-out']));
    expect(args).not.toContain('--estabelecimento-id');
  });

  it('buildParserArgs includes partial ID flags', () => {
    const args = buildParserArgs('/tmp/sample.csv', '--pg-write', {
      estabelecimentoId: 42,
    });
    expect(args).toEqual(
      expect.arrayContaining(['--estabelecimento-id', '42'])
    );
    expect(args).not.toContain('--equipe-id');
  });

  it('preview parses JSON metadata without DB write flag', async () => {
    mockSpawn({
      stdout: JSON.stringify([
        {
          tipo_relatorio: 'atendimento_individual',
          competencia: '2026-05-01',
          unidade: 'CAFI',
          equipe_nome: 'EQUIPE 9 EAP',
        },
      ]),
    });

    const result = await preview('/tmp/sample.csv');
    expect(result[0].tipo_relatorio).toBe('atendimento_individual');
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['/tmp/sample.csv', '--json-out']),
      expect.any(Object)
    );
  });

  it('processar uses --pg-write flag', async () => {
    mockSpawn({
      stdout: JSON.stringify([{ carga_id: 1, status: 'ok' }]),
    });

    const result = await processar('/tmp/sample.csv');
    expect(result[0].carga_id).toBe(1);
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--pg-write']),
      expect.any(Object)
    );
  });

  it('processar forwards estabelecimento and equipe IDs to spawn', async () => {
    mockSpawn({
      stdout: JSON.stringify([
        { carga_id: 1, status: 'ok', estabelecimento_id: 42, equipe_id: 7 },
      ]),
    });

    await processar('/tmp/sample.csv', {
      estabelecimentoId: 42,
      equipeId: 7,
    });

    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining([
        '/tmp/sample.csv',
        '--pg-write',
        '--estabelecimento-id',
        '42',
        '--equipe-id',
        '7',
      ]),
      expect.any(Object)
    );
  });

  it('preview does not pass ID flags', async () => {
    mockSpawn({ stdout: '[]' });

    await preview('/tmp/sample.csv');

    const spawnArgs = spawn.mock.calls[0][1];
    expect(spawnArgs).not.toContain('--estabelecimento-id');
    expect(spawnArgs).not.toContain('--equipe-id');
  });

  it('rejects parser stderr with 422 status', async () => {
    mockSpawn({ code: 1, stderr: 'CSV inválido' });

    await expect(preview('/tmp/bad.csv')).rejects.toMatchObject({
      status: 422,
      message: /CSV inválido/,
    });
  });

  it('returns empty array when stdout is empty', async () => {
    mockSpawn({ stdout: '' });
    await expect(preview('/tmp/empty.csv')).resolves.toEqual([]);
  });

  it('rejects invalid JSON stdout', async () => {
    mockSpawn({ stdout: 'not-json' });

    await expect(processar('/tmp/x.csv')).rejects.toMatchObject({
      status: 502,
      message: /JSON inválida/i,
    });
  });
});
