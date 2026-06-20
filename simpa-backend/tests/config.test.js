jest.mock('../src/services/db');

const request = require('supertest');
const { query } = require('../src/services/db');
const app = require('../src/app');

describe('config routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /competencia-padrao returns stored value without auth', async () => {
    query.mockResolvedValueOnce({ rows: [{ valor: '2026-04' }] });

    const res = await request(app).get('/api/config/competencia-padrao');

    expect(res.status).toBe(200);
    expect(res.body.competencia).toBe('2026-04');
  });

  it('GET /competencia-padrao falls back when missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/config/competencia-padrao');

    expect(res.status).toBe(200);
    expect(res.body.competencia).toBe('2026-05');
  });
});
