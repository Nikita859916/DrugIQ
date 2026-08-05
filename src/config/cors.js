// ─── config/cors.js ─────────────────────────────────────────────────────────
// Fine-grained CORS configuration.
// Reads allowed origins from ALLOWED_ORIGINS env (comma-separated).
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { ENV } = require('../constants');

/**
 * Parse comma-separated ALLOWED_ORIGINS env var into an array.
 * In development, all origins are allowed.
 */
const parseAllowedOrigins = () => {
  if (process.env.NODE_ENV === ENV.DEVELOPMENT) return '*';

  const raw = process.env.ALLOWED_ORIGINS || '';
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins === '*') return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`CORS policy: Origin "${origin}" is not allowed.`),
      false
    );
  },

  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Api-Key',
  ],

  exposedHeaders: [
    'X-Total-Count',
    'X-Page',
    'X-Limit',
    'X-Total-Pages',
    'Retry-After',
  ],

  credentials: true,

  // Cache preflight response for 24 hours
  maxAge: 86_400,

  optionsSuccessStatus: 204,
};

module.exports = corsOptions;
