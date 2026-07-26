// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);

  // PostgreSQL unique_violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Registro duplicado (violação de unicidade)',
      detail: err.detail || undefined,
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Erro interno',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
