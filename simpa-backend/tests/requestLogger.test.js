const requestLogger = require('../src/middleware/requestLogger');

describe('requestLogger', () => {
  it('assigns requestId and logs durationMs on finish', () => {
    const listeners = {};
    const req = { method: 'GET', url: '/api/health', headers: {} };
    const res = {
      headers: {},
      statusCode: 200,
      setHeader(name, value) {
        this.headers[name] = value;
      },
      on(event, handler) {
        listeners[event] = handler;
      },
    };
    const next = jest.fn();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    requestLogger(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.requestId).toBeDefined();
    expect(res.headers['x-request-id']).toBe(req.requestId);

    listeners.finish();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"durationMs"')
    );

    logSpy.mockRestore();
  });

  it('reuses incoming x-request-id header', () => {
    const req = {
      method: 'GET',
      url: '/api/health',
      headers: { 'x-request-id': 'fixed-id' },
    };
    const res = {
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      on() {},
    };

    requestLogger(req, res, () => {});

    expect(req.requestId).toBe('fixed-id');
  });
});
