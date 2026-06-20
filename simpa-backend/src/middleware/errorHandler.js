function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const payload = {
    error: err.message || 'Erro interno',
    requestId: req.requestId,
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }

  console.error(
    JSON.stringify({
      level: 'error',
      requestId: req.requestId,
      status,
      message: err.message,
    })
  );

  res.status(status).json(payload);
}

module.exports = errorHandler;
