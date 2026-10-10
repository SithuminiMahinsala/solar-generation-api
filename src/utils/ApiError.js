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
  static notFound(message, details = []) {
    return new ApiError(404, 'RESOURCE_NOT_FOUND', message, details);
  }
  static conflict(message, details = []) {
    return new ApiError(409, 'CONFLICT', message, details);
  }
  static preconditionFailed(message, details = []) {
    return new ApiError(412, 'PRECONDITION_FAILED', message, details);
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
}

module.exports = ApiError;