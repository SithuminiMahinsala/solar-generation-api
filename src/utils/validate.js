const ApiError = require('./ApiError');

// Joi rejects unknown fields by default, which is what we want for writes.
function validateBody(schema, body) {
  // Express 5 leaves req.body undefined when no JSON was sent
  if (body === undefined || body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw ApiError.badRequest('Request body must be a JSON object', [
      { field: 'body', issue: 'send a JSON object with Content-Type: application/json' },
    ]);
  }
  const { value, error } = schema.validate(body, { abortEarly: false });
  if (error) {
    throw ApiError.badRequest(
      'Invalid request body',
      error.details.map((d) => ({ field: d.path.join('.'), issue: d.message }))
    );
  }
  return value;
}

module.exports = { validateBody };