// ─── middlewares/notFound.js ─────────────────────────────────────────────────
// 404 middleware — catches any request that didn't match a registered route
// and forwards a consistent AppError to the error handler.
// Must be registered AFTER all routes, and BEFORE errorHandler.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const AppError = require('../utils/AppError');

/**
 * @param {import('express').Request}  req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
const notFound = (req, _res, next) => {
  next(
    new AppError(
      `Route not found: [${req.method}] ${req.originalUrl}`,
      404,
      'ROUTE_NOT_FOUND'
    )
  );
};

module.exports = notFound;
