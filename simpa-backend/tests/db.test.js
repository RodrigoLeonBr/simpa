const mockQuery = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    query: mockQuery,
  })),
}));

describe('db service', () => {
  beforeEach(() => {
    jest.resetModules();
    mockQuery.mockReset();
  });

  it('registers pool error handler and exposes query helper', async () => {
    const { Pool } = require('pg');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockQuery.mockResolvedValueOnce({ rows: [{ ok: 1 }] });

    const db = require('../src/services/db');
    const poolInstance = Pool.mock.results[0].value;
    const errorHandler = poolInstance.on.mock.calls.find(([event]) => event === 'error')[1];

    errorHandler(new Error('idle timeout'));
    const result = await db.query('SELECT 1');

    expect(result.rows[0].ok).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith('pg pool error:', 'idle timeout');

    errorSpy.mockRestore();
  });
});
