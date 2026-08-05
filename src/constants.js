// ─── Centralised Constants ──────────────────────────────────────────────────
// All magic strings, numeric literals, and shared enums live here.
// Import from this file; never hard-code values in business logic.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

// ── API ──────────────────────────────────────────────────────────────────────
const API = Object.freeze({
  VERSION: 'v1',
  PREFIX: '/api/v1',
  DOCS_PATH: '/api/docs',
  HEALTH_PATH: '/api/health',
});

// ── HTTP Status Codes (supplement http-status-codes package) ─────────────────
const HTTP = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
});

// ── Environment Labels ───────────────────────────────────────────────────────
const ENV = Object.freeze({
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test',
  STAGING: 'staging',
});

// ── Rate Limiting ────────────────────────────────────────────────────────────
const RATE_LIMIT = Object.freeze({
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  SKIP_PATHS: ['/api/health', '/api/docs'],
});

// ── Pagination ───────────────────────────────────────────────────────────────
const PAGINATION = Object.freeze({
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
});

// ── Sorting ──────────────────────────────────────────────────────────────────
const SORT = Object.freeze({
  ASC: 'asc',
  DESC: 'desc',
});

// ── Review Ratings ───────────────────────────────────────────────────────────
const RATING = Object.freeze({
  MIN: 1,
  MAX: 10,
});

// ── Upload ───────────────────────────────────────────────────────────────────
const UPLOAD = Object.freeze({
  MAX_FILE_SIZE_MB: 50,
  ALLOWED_MIME_TYPES: ['text/csv', 'application/json'],
  DEST_DIR: 'src/uploads',
});

// ── Logging ──────────────────────────────────────────────────────────────────
const LOG = Object.freeze({
  LEVELS: ['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'],
  DEFAULT_LEVEL: 'info',
  DATE_PATTERN: 'YYYY-MM-DD',
  MAX_FILES: '14d',
  MAX_SIZE: '20m',
});

// ── Error Types ───────────────────────────────────────────────────────────────
const ERROR_TYPES = Object.freeze({
  VALIDATION: 'ValidationError',
  CAST: 'CastError',
  DUPLICATE_KEY: 'MongoServerError',
  JWT: 'JsonWebTokenError',
  JWT_EXPIRED: 'TokenExpiredError',
  NOT_FOUND: 'NotFoundError',
  APP: 'AppError',
});

// ── Mongoose ─────────────────────────────────────────────────────────────────
const MONGOOSE = Object.freeze({
  DUPLICATE_KEY_CODE: 11000,
});

module.exports = {
  API,
  HTTP,
  ENV,
  RATE_LIMIT,
  PAGINATION,
  SORT,
  RATING,
  UPLOAD,
  LOG,
  ERROR_TYPES,
  MONGOOSE,
};
