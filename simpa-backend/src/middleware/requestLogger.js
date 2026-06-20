const crypto = require('crypto');

function requestLogger(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    console.log(
      JSON.stringify({
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: Date.now() - start,
      })
    );
  });

  next();
}

module.exports = requestLogger;
