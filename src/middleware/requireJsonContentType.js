const ApiError = require('../utils/ApiError');

// req.is() returns null when there is no body, false when the type doesn't match
module.exports = function requireJsonContentType(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.is('application/json') === false) {
    return next(
      ApiError.unsupportedMediaType('This API only accepts application/json', [
        { field: 'Content-Type', issue: `unsupported: ${req.get('Content-Type')}` },
      ])
    );
  }
  next();
};