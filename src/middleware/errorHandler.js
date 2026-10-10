const ApiError = require('../utils/ApiError');

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function errorHandler(err, req, res, next) {
  // malformed JSON body
  if (err.type === 'entity.parse.failed') {
    err = ApiError.badRequest('Malformed JSON body');
  }
  if (err instanceof ApiError) {
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