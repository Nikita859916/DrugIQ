// ─── utils/AppError.js ───────────────────────────────────────────────────────
// Custom operational error class.
// Extending the native Error gives us a proper stack trace while letting
// the error handler distinguish operational vs. programmer errors.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

class AppError extends Error {
  /**
   * @param {string}  message    - Human-readable error message
   * @param {number}  statusCode - HTTP status code (default 500)
   * @param {string}  [code]     - Optional machine-readable error code
   * @param {object}  [details]  - Optional additional error details / metadata
   */
  constructor(message, statusCode = 500, code = null, details = null) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    /**
     * isOperational = true → expected, user-facing error (4xx / known 5xx).
     * isOperational = false → unexpected programmer error — should alert on-call.
     */
    this.isOperational = true;

    // Capture clean stack trace (excludes AppError constructor frame)
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convenience factory methods for common HTTP errors.
   */
  static badRequest(message, code, details) {
    return new AppError(message, 400, code, details);
  }

  static unauthorized(message = 'Unauthorized', code) {
    return new AppError(message, 401, code);
  }

  static forbidden(message = 'Forbidden', code) {
    return new AppError(message, 403, code);
  }

  static notFound(resource = 'Resource') {
    return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
  }

  static conflict(message, code) {
    return new AppError(message, 409, code);
  }

  static unprocessable(message, details) {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }

  static internal(message = 'Internal server error') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }

  /**
   * Serialize to a plain object (used by error handler middleware).
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
    };
  }
}

module.exports = AppError;
