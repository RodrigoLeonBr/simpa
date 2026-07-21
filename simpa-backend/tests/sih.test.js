'use strict';

const { EventEmitter } = require('events');

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('../src/services/db');

const { spawn } = require('child_process');
const { query } = require('../src/services/db');
const {
  sincronizar,
  parseSyncOutput,
  getSyncProgress,
  getCompetenciaImportada,
  listSincronizacoes,
} = require('../src/services/sih');

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

beforeEach(() => {
  jest.clearAllMocks();
  query.mockResolvedValue({ rows: [] });
});

// ---------------------------------------------------------------------------
// parseSyncOutput
// ---------------------------------------------------------------------------

describe('parseSyncOutput', () => {
  it('unwraps single-item arrays', () => {
    expect(
      parseSyncOutput('[{"status":"ok","qtd_internacoes":3}]')
    ).toEqual({ status: 'ok', qtd_internacoes: 3 });
  });

  it('keeps multi-item arrays intact', () => {
    const payload = [{ status: 'ok' }, { status: 'parcial' }];
    expect(parseSyncOutput(JSON.stringify(payload))).toEqual(payload);
  });

  it('accepts plain object JSON', () => {
    expect(
      parseSyncOutput('{"status":"ok","qtd_internacoes":5}')
    ).toEqual({ status: 'ok', qtd_internacoes: 5 });
  });
});

// ---------------------------------------------------------------------------
// sincronizar — happy path
// ---------------------------------------------------------------------------

describe('sincronizar', () => {
  it('resolves with result on success', async () => {
    mockSpawn({
      stdout: JSON.stringify([{
        sincronizacao_id: 1,
        competencia: '2025-01-01',
        status: 'ok',
        qtd_internacoes: 42,
        qtd_procedimentos: 110,
        orphan_cnes: 0,
        erros: 0,
      }]),
    });

    const result = await sincronizar('2025-01');
    expect(result).toMatchObject({ status: 'ok', qtd_internacoes: 42 });
    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--competencia', '2025-01', '--pg-write']),
      expect.any(Object)
    );
  });

  it('passes --reimportar when requested', async () => {
    mockSpawn({
      stdout: JSON.stringify([{
        sincronizacao_id: 2, competencia: '2025-01-01',
        status: 'ok', qtd_internacoes: 5, qtd_procedimentos: 10,
        orphan_cnes: 0, erros: 0,
      }]),
    });

    await sincronizar('2025-01', { reimportar: true });

    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--reimportar']),
      expect.any(Object)
    );
  });

  it('tracks SIH_PROGRESS events in cache', async () => {
    const execId = 'sih_test_track1';
    mockSpawn({
      stderr: 'SIH_PROGRESS {"stage":"extracao_mysql","event":"extract_block","block_rows":500}\n',
      stdout: JSON.stringify([{
        sincronizacao_id: 3, competencia: '2025-01-01',
        status: 'ok', qtd_internacoes: 10, qtd_procedimentos: 20,
        orphan_cnes: 1, erros: 0,
      }]),
    });

    await sincronizar('2025-01', { executionId: execId });

    expect(spawn).toHaveBeenCalledWith(
      expect.any(String),
      expect.arrayContaining(['--exec-id', execId]),
      expect.any(Object)
    );

    const progress = getSyncProgress(execId);
    expect(progress).toBeTruthy();
    expect(progress.status).toBe('done');
    expect(progress.events.some((e) => e.event === 'extract_block')).toBe(true);
    expect(progress.summary.qtd_internacoes).toBe(10);
    expect(progress.summary.qtd_procedimentos).toBe(20);
  });

  it('ignores SIA_PROGRESS lines (only SIH_PROGRESS parsed)', async () => {
    const execId = 'sih_test_track2';
    mockSpawn({
      stderr: 'SIA_PROGRESS {"stage":"ignored","event":"sia_event"}\n',
      stdout: JSON.stringify([{
        sincronizacao_id: 4, competencia: '2025-01-01',
        status: 'ok', qtd_internacoes: 0, qtd_procedimentos: 0,
        orphan_cnes: 0, erros: 0,
      }]),
    });

    await sincronizar('2025-01', { executionId: execId });

    const progress = getSyncProgress(execId);
    // Only 'start' event should exist (no sia_event)
    expect(progress.events.every((e) => e.event !== 'sia_event')).toBe(true);
  });

  it('rejects on non-zero exit', async () => {
    mockSpawn({ code: 1, stderr: 'MySQL connection refused' });
    await expect(sincronizar('2025-01')).rejects.toMatchObject({ status: 502 });
  });

  it('rejects empty stdout', async () => {
    mockSpawn({ stdout: '' });
    await expect(sincronizar('2025-01')).rejects.toMatchObject({
      status: 502,
      message: /vazia/i,
    });
  });
});

// ---------------------------------------------------------------------------
// getSyncProgress
// ---------------------------------------------------------------------------

describe('getSyncProgress', () => {
  it('returns null for unknown executionId', () => {
    expect(getSyncProgress('does-not-exist')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(getSyncProgress(null)).toBeNull();
    expect(getSyncProgress(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCompetenciaImportada
// ---------------------------------------------------------------------------

describe('getCompetenciaImportada', () => {
  it('returns exists=false when no row found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await getCompetenciaImportada('2025-01');
    expect(result.exists).toBe(false);
    expect(result.qtd_internacoes).toBe(0);
  });

  it('returns exists=true with counts when row found', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        status: 'ok',
        qtd_aih: 801,
        qtd_internacoes: 120,
        qtd_procedimentos: 380,
        sincronizado_em: '2025-02-01T10:00:00Z',
      }],
    });
    const result = await getCompetenciaImportada('2025-01');
    expect(result.exists).toBe(true);
    expect(result.qtd_aih).toBe(801);
    expect(result.qtd_internacoes).toBe(120);
    expect(result.qtd_procedimentos).toBe(380);
  });

  it('returns null for invalid competencia format', async () => {
    const result = await getCompetenciaImportada('202501');
    expect(result).toBeNull();
  });

  it('queries sih_sincronizacoes (not sia_sincronizacoes)', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await getCompetenciaImportada('2025-01');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('sih_sincronizacoes'),
      expect.any(Array)
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('sia_sincronizacoes'),
      expect.any(Array)
    );
  });
});

describe('listSincronizacoes', () => {
  it('returns empty array when no syncs', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await listSincronizacoes();
    expect(result).toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('attaches por_cnes breakdown to each sync', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{
          id: 3,
          competencia: '2026-03-01',
          status: 'ok',
          qtd_aih: 801,
          qtd_internacoes: 496,
          qtd_procedimentos: 839,
          orphan_cnes: 0,
          erros: 0,
          sincronizado_em: '2026-07-21T14:59:36Z',
        }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            sincronizacao_id: 3,
            cnes: '2058790',
            unidade: 'HOSPITAL MUNICIPAL DR WALDEMAR TEBA',
            qtd_aih: 779,
            qtd_internacoes: 480,
            qtd_procedimentos: 13917,
          },
          {
            sincronizacao_id: 3,
            cnes: '2082179',
            unidade: 'HOSPITAL SAO FRANCISCO',
            qtd_aih: 22,
            qtd_internacoes: 16,
            qtd_procedimentos: 202,
          },
        ],
      });

    const result = await listSincronizacoes();
    expect(result).toHaveLength(1);
    expect(result[0].qtd_aih).toBe(801);
    expect(result[0].qtd_procedimentos).toBe(14119);
    expect(result[0].por_cnes).toHaveLength(2);
    expect(result[0].por_cnes[0].cnes).toBe('2058790');
    expect(result[0].por_cnes[0].qtd_aih).toBe(779);
    expect(result[0].por_cnes[0].qtd_procedimentos).toBe(13917);
    expect(result[0].por_cnes[1].qtd_aih).toBe(22);
    expect(query.mock.calls[1][0]).toMatch(/qtd_linhas/);
  });
});
