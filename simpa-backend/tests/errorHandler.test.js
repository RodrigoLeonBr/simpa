const errorHandler = require('../src/middleware/errorHandler');

function createMocks() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const req = { requestId: 'test-request-id' };
  const res = { status };
  const next = jest.fn();
  return { req, res, next, status, json };
}

describe('errorHandler', () => {
  it('returns custom status and message', () => {
    const { req, res, next, status, json } = createMocks();
    const err = new Error('validation failed');
    err.status = 422;

    errorHandler(err, req, res, next);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({
      error: 'validation failed',
      requestId: 'test-request-id',
      stack: expect.any(String),
    });
  });

  it('defaults to 500 for unhandled errors', () => {
    const { req, res, next, status, json } = createMocks();

    errorHandler(new Error('boom'), req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'boom', requestId: 'test-request-id' })
    );
  });

  it('omits stack in production', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const { req, res, next, status, json } = createMocks();

    errorHandler(new Error('hidden'), req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'hidden',
      requestId: 'test-request-id',
    });

    process.env.NODE_ENV = previous;
  });

  it('uses fallback message when err.message is empty', () => {
    const { req, res, next, status, json } = createMocks();

    errorHandler({}, req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Erro interno' })
    );
  });
});
