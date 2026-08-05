// ─── config/rateLimiter.js ───────────────────────────────────────────────────
// Express-rate-limit configuration.
// Different limiters can be applied to different route groups.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const rateLimit = require('express-rate-limit');
const { RATE_LIMIT, HTTP } = require('../constants');

// ── Response Handler ─────────────────────────────────────────────────────────
const rateLimitHandler = (_req, res) => {
  res.status(HTTP.TOO_MANY_REQUESTS).json({
    success: false,
    statusCode: HTTP.TOO_MANY_REQUESTS,
    message:
      'Too many requests from this IP — please wait and try again later.',
  });
};

// ── Skip Function ────────────────────────────────────────────────────────────
const shouldSkip = (req) =>
  RATE_LIMIT.SKIP_PATHS.some((p) => req.path.startsWith(p));

// ── Global API Limiter ────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || RATE_LIMIT.WINDOW_MS,
  max: Number(process.env.RATE_LIMIT_MAX) || RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: 'draft-7', // RateLimit headers per RFC draft
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: shouldSkip,
  message: 'Too many requests',
});

// ── Strict Limiter (for write / expensive endpoints) ─────────────────────────
const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
  skip: shouldSkip,
});

// ── Upload Limiter ────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
});

module.exports = { globalLimiter, strictLimiter, uploadLimiter };
