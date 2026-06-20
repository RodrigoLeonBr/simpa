const request = require('supertest');
const app = require('../../src/app');

const hasPg =
  process.env.PG_HOST &&
  process.env.PG_DB &&
  process.env.PG_USER &&
  process.env.PG_PASS;

const describeIfPg = hasPg ? describe : describe.skip;

describeIfPg('GET /api/health integration', () => {
  it('responds against live postgres', async () => {
    const res = await request(app).get('/api/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('postgres');
    expect(res.body.service).toBe('simpa-api');
  });
});
