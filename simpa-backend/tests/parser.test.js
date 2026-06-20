const { EventEmitter } = require('events');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');
const { preview, processar } = require('../src/services/parser');

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
