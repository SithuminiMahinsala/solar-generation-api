const ApiError = require('../utils/ApiError');

// Responds 406 if the client's Accept header excludes JSON.
// A missing Accept header or */* is fine.
module.exports = function requireJson(req, res, next) {
  const accept = req.get('Accept');
  if (accept && !req.accepts('json')) {
    return next(
      new ApiError(406, 'NOT_ACCEPTABLE', 'This API only produces application/json', [
        { field: 'Accept', issue: `unsupported media type: ${accept}` },
      ])
    );
  }
  next();
};