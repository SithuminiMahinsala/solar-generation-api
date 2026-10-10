class ApiError extends Error {
  constructor(status, code, message, details = [], headers = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
  static badRequest(message, details = []) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthorized(message = 'Authentication required', details = []) {
    return new ApiError(401, 'UNAUTHENTICATED', message, details, {
      'WWW-Authenticate': 'Bearer',
    });
  }
  static forbidden(message = 'You do not have permission to perform this action', details = []) {
    return new ApiError(403, 'FORBIDDEN', message, details);
  }
  static notFound(message, details = []) {
    return new ApiError(404, 'RESOURCE_NOT_FOUND', message, details);
  }
  static methodNotAllowed(allowed, message) {
    return new ApiError(
      405,
      'METHOD_NOT_ALLOWED',
      message,
      [{ field: 'method', issue: `allowed methods: ${allowed.join(', ')}` }],
      { Allow: allowed.join(', ') }
    );
  }
  static conflict(message, details = []) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
  static preconditionFailed(message, details = []) {
    return new ApiError(412, 'PRECONDITION_FAILED', message, details);
  }
  static payloadTooLarge(message, details = []) {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', message, details);
  }
  static unsupportedMediaType(message, details = []) {
    return new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', message, details);
  }
  static tooManyRequests(message = 'Too many requests, please slow down') {
    return new ApiError(429, 'RATE_LIMITED', message, [
      { field: 'rate', issue: 'see the Retry-After header' },
    ]);
  }
}

module.exports = ApiError;