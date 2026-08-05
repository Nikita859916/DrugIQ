// ─── middlewares/requestLogger.js ────────────────────────────────────────────
// Morgan HTTP request logger integrated with Winston.
// Skips health-check and docs routes to keep logs clean.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const morgan = require('morgan');
const logger = require('../utils/logger');
const { ENV } = require('../constants');

// ── Custom token: request body (trimmed for safety) ──────────────────────────
morgan.token('body', (req) => {
  const body = req.body;
  if (!body || !Object.keys(body).length) return '-';
  // Strip sensitive fields before logging
  const safe = { ...body };
  ['password', 'token', 'secret', 'authorization'].forEach((k) => {
    if (safe[k]) safe[k] = '[REDACTED]';
  });
  return JSON.stringify(safe);
});

// ── Format strings ────────────────────────────────────────────────────────────
const DEV_FORMAT =
  ':method :url :status :response-time ms - :res[content-length]';

const PROD_FORMAT =
  ':remote-addr - :method :url HTTP/:http-version :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

// ── Skip paths ───────────────────────────────────────────────────────────────
const SKIP_PATHS = ['/api/health', '/api/docs', '/favicon.ico'];

const skip = (req) =>
  SKIP_PATHS.some((p) => req.originalUrl.startsWith(p));

// ── Export configured Morgan middleware ──────────────────────────────────────
const format =
  process.env.NODE_ENV === ENV.PRODUCTION ? PROD_FORMAT : DEV_FORMAT;

const requestLogger = morgan(format, {
  stream: logger.stream,
  skip,
});

module.exports = requestLogger;
