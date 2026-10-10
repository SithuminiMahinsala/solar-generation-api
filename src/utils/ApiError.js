class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  static badRequest(message, details = []) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }
  static notFound(message, details = []) {
    return new ApiError(404, 'RESOURCE_NOT_FOUND', message, details);
  }
}

module.exports = ApiError;