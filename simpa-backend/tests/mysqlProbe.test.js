const { EventEmitter } = require('events');

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');
const { mysqlConfigured, probeMysql } = require('../src/services/mysqlProbe');

function mockSpawnClose(code) {
  const proc = new EventEmitter();
  spawn.mockImplementationOnce(() => {
    process.nextTick(() => proc.emit('close', code));
    return proc;
  });
}

describe('mysqlProbe', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns not_configured when env vars are missing', async () => {
    delete process.env.MYSQL_HOST;
    delete process.env.MYSQL_DB;
    delete process.env.MYSQL_USER;
    delete process.env.MYSQL_PASS;

    expect(mysqlConfigured()).toBe(false);
    await expect(probeMysql()).resolves.toEqual({
      configured: false,
      status: 'not_configured',
    });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('returns connected when python probe succeeds', async () => {
    process.env.MYSQL_HOST = '127.0.0.1';
    process.env.MYSQL_DB = 'producao';
    process.env.MYSQL_USER = 'readonly';
    process.env.MYSQL_PASS = 'secret';

    mockSpawnClose(0);

    await expect(probeMysql()).resolves.toEqual({
      configured: true,
      status: 'connected',
    });
  });

  it('returns unavailable when spawn errors', async () => {
    process.env.MYSQL_HOST = '127.0.0.1';
    process.env.MYSQL_DB = 'producao';
    process.env.MYSQL_USER = 'readonly';
    process.env.MYSQL_PASS = 'secret';

    const proc = new EventEmitter();
    spawn.mockImplementationOnce(() => {
      process.nextTick(() => proc.emit('error', new Error('spawn failed')));
      return proc;
    });

    await expect(probeMysql()).resolves.toEqual({
      configured: true,
      status: 'unavailable',
    });
  });

  it('returns unavailable when python probe fails', async () => {
    process.env.MYSQL_HOST = '127.0.0.1';
    process.env.MYSQL_DB = 'producao';
    process.env.MYSQL_USER = 'readonly';
    process.env.MYSQL_PASS = 'secret';

    mockSpawnClose(1);

    await expect(probeMysql()).resolves.toEqual({
      configured: true,
      status: 'unavailable',
    });
  });
});
