jest.mock('../src/services/db');
jest.mock('../src/services/mysqlProbe', () => ({
  probeMysql: jest.fn(),
}));

const request = require('supertest');
const { query } = require('../src/services/db');
const { probeMysql } = require('../src/services/mysqlProbe');
const app = require('../src/app');

describe('GET /api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    probeMysql.mockResolvedValue({ configured: true, status: 'connected' });
  });

  it('returns 200 when postgres is reachable', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ ok: 1 }] })
      .mockResolvedValueOnce({
        rows: [
          { tablename: 'esus_cargas' },
          { tablename: 'estabelecimentos' },
          { tablename: 'usuarios' },
        ],
      });

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.postgres).toBe('connected');
    expect(res.body.mysql).toBe('connected');
    expect(res.body.mysql_configured).toBe(true);
    expect(res.body.schema_tables).toEqual([
      'esus_cargas',
      'estabelecimentos',
      'usuarios',
    ]);
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('returns 503 when postgres is unreachable', async () => {
    query.mockRejectedValueOnce(new Error('connection refused'));

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.postgres).toBe('disconnected');
    expect(res.body.error).toMatch(/connection refused/i);
  });
});
