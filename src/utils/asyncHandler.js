// ─── utils/asyncHandler.js ───────────────────────────────────────────────────
// Wraps async route handlers so you never need try/catch in controllers.
// Any rejected promise is forwarded to Express's next(err) pipeline.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

/**
 * Wraps an async Express route handler (or middleware) and forwards
 * any unhandled rejection to the centralized error handler via next().
 *
 * @param {Function} fn - async (req, res, next) => void
 * @returns {Function}  - Express-compatible middleware function
 *
 * @example
 * router.get('/drugs', asyncHandler(async (req, res) => {
 *   const drugs = await DrugService.findAll();
 *   res.json({ success: true, data: drugs });
 * }));
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
