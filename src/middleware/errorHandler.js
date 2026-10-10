const ApiError = require('../utils/ApiError');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    err = ApiError.badRequest('Malformed JSON body');
  }
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    err = ApiError.conflict('A resource with these unique values already exists',
      fields.map((f) => ({ field: f, issue: 'must be unique' })));
  }
  if (err instanceof ApiError) {
    if (err.headers) res.set(err.headers);
    return res.status(err.status).json({ code: err.code, message: err.message, details: err.details });
  }
  console.error(err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: [],
  });
}

module.exports = { notFoundHandler, errorHandler };