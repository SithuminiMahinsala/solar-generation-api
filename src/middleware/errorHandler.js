const ApiError = require('../utils/ApiError');
const routeTable = require('../utils/routeTable');

// Reached only when no route handled the request
function notFoundHandler(req, res, next) {
  const hit = routeTable.find(([pattern]) => pattern.test(req.path));
  if (hit) {
    return next(
      ApiError.methodNotAllowed(hit[1], `${req.method} is not supported on this resource`)
    );
  }
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

// Turn library and driver errors into ApiErrors; return null if unrecognised
function normalise(err) {
  if (err instanceof ApiError) return err;

  switch (err.type) { // errors raised by express.json()
    case 'entity.parse.failed':
      return ApiError.badRequest('Malformed JSON body', [
        { field: 'body', issue: 'body is not valid JSON' },
      ]);
    case 'entity.too.large':
      return ApiError.payloadTooLarge('Request body is too large', [
        { field: 'body', issue: 'maximum body size is 10 KB' },
      ]);
    case 'encoding.unsupported':
    case 'charset.unsupported':
      return ApiError.unsupportedMediaType('Unsupported character encoding', [
        { field: 'Content-Type', issue: 'use UTF-8' },
      ]);
  }

  if (err.code === 11000) { // MongoDB duplicate key
    const fields = Object.keys(err.keyPattern || {});
    return ApiError.conflict(
      'A resource with these unique values already exists',
      fields.map((f) => ({ field: f, issue: 'must be unique' }))
    );
  }
  if (err.name === 'CastError') {
    return ApiError.badRequest('Invalid value', [{ field: err.path, issue: 'wrong type' }]);
  }
  if (err.name === 'ValidationError' && err.errors) { // Mongoose
    return ApiError.badRequest(
      'Invalid data',
      Object.entries(err.errors).map(([field, e]) => ({ field, issue: e.message }))
    );
  }
  return null;
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const apiErr = normalise(err);
  if (apiErr) {
    if (apiErr.headers) res.set(apiErr.headers);
    return res
      .status(apiErr.status)
      .json({ code: apiErr.code, message: apiErr.message, details: apiErr.details });
  }

  console.error(err); // full detail stays in the server log only
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: [],
  });
}

module.exports = { notFoundHandler, errorHandler };