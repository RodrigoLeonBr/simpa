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

  it('GET /competencias returns the month range across sources without auth', async () => {
    query.mockResolvedValueOnce({
      rows: [{ competencia: '2026-03' }, { competencia: '2026-02' }, { competencia: '2026-01' }],
    });

    const res = await request(app).get('/api/config/competencias');

    expect(res.status).toBe(200);
    expect(res.body.competencias).toEqual(['2026-03', '2026-02', '2026-01']);
  });
});
