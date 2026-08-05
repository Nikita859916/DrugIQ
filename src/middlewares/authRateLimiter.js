// ─── middlewares/authRateLimiter.js ───────────────────────────────────────────
// Rate limiters for sensitive authentication endpoints (Login, Register, Reset).
// Protects against brute-force and credential-stuffing attacks.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const rateLimit = require('express-rate-limit');
const { HTTP } = require('../constants');

const rateLimitHandler = (message) => (_req, res) => {
  res.status(HTTP.TOO_MANY_REQUESTS).json({
    success: false,
    statusCode: HTTP.TOO_MANY_REQUESTS,
    code: 'RATE_LIMIT_EXCEEDED',
    message,
  });
};

/**
 * Strict Rate Limiter for Login Endpoint
 * Allows max 5 login attempts per 15-minute window per IP.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler(
    'Too many failed login attempts from this IP. Please try again after 15 minutes.'
  ),
});

/**
 * Rate Limiter for Account Registration
 * Allows max 3 registrations per hour per IP.
 */
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler(
    'Too many accounts created from this IP. Please try again later.'
  ),
});

/**
 * Rate Limiter for Forgot / Reset Password Endpoints
 * Allows max 3 attempts per 15 minutes.
 */
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler(
    'Too many password reset requests from this IP. Please try again later.'
  ),
});

module.exports = {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
};
