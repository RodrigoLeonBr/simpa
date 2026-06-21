jest.mock('../src/services/db');
jest.mock('fs');
jest.mock('child_process');

const fs = require('fs');
const { spawn } = require('child_process');
const { pool } = require('../src/services/db');
const backupService = require('../src/services/backupService');

describe('backupService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PG_HOST = 'localhost';
    process.env.PG_PORT = '5432';
    process.env.PG_USER = 'postgres';
    process.env.PG_PASS = 'secret';
    process.env.PG_DB = 'simpa';
    process.env.UPLOAD_DIR = '/tmp/simpa-upload-test';

    fs.mkdirSync.mockImplementation(() => undefined);
    fs.readdirSync.mockReturnValue([]);
    fs.writeFileSync.mockImplementation(() => undefined);
    fs.statSync.mockReturnValue({
      size: 128,
      mtime: new Date('2026-06-21T12:00:00.000Z'),
    });
    fs.existsSync.mockReturnValue(true);
    fs.unlinkSync.mockImplementation(() => undefined);

    spawn.mockImplementation((cmd) => ({
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          cb(cmd === 'missing-bin' ? 1 : 0);
        }
      }),
    }));
  });

  it('rejects invalid backup filename', () => {
    expect(backupService.safeBackupFilename('../etc/passwd')).toBeNull();
    expect(backupService.safeBackupFilename('simpa-backup-2026-06-21T12-00-00-000Z.sql')).toBe(
      'simpa-backup-2026-06-21T12-00-00-000Z.sql'
    );
  });

  it('requires RESTAURAR confirmation', async () => {
    await expect(
      backupService.restoreFromStored('simpa-backup-2026-06-21T12-00-00-000Z.sql', 'nao')
    ).rejects.toThrow('Confirmação inválida');
  });

  it('creates backup using pure JS when pg_dump is unavailable', async () => {
    spawn.mockImplementation((cmd, args) => ({
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, cb) => {
        if (event === 'close') {
          const failed = cmd === 'pg_dump' && args[0] === '--version';
          cb(failed ? 1 : 0);
        }
      }),
    }));

    const client = {
      query: jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ tablename: 'usuarios' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, username: 'admin' }] })
        .mockResolvedValueOnce({ rows: [{ column_name: 'id' }] }),
      release: jest.fn(),
    };
    pool.connect = jest.fn().mockResolvedValue(client);

    const backup = await backupService.createBackup();

    expect(backup.filename).toMatch(/^simpa-backup-/);
    expect(fs.writeFileSync).toHaveBeenCalled();
    expect(client.release).toHaveBeenCalled();
  });

  it('lists backups from upload dir', () => {
    fs.readdirSync.mockReturnValue([
      'simpa-backup-2026-06-21T12-00-00-000Z.sql',
      'ignore.txt',
    ]);

    const rows = backupService.listBackups();
    expect(rows).toHaveLength(1);
    expect(rows[0].filename).toBe('simpa-backup-2026-06-21T12-00-00-000Z.sql');
  });
});
