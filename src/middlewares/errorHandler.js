// ─── middlewares/errorHandler.js ─────────────────────────────────────────────
// Centralised Express error-handling middleware.
// Must be registered LAST, after all routes.
//
// Handles:
//  - AppError (operational)
//  - Mongoose ValidationError / CastError / Duplicate Key
//  - JWT errors (ready for auth layer)
//  - Generic unknown errors
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const { ENV, ERROR_TYPES, MONGOOSE } = require('../constants');

const isDev = () => process.env.NODE_ENV === ENV.DEVELOPMENT;

// ── Mongoose: CastError (invalid ObjectId, etc.) ─────────────────────────────
const handleCastError = (err) =>
  AppError.badRequest(
    `Invalid value "${err.value}" for field "${err.path}".`,
    'INVALID_ID'
  );

// ── Mongoose: ValidationError ─────────────────────────────────────────────────
const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map((e) => e.message);
  return AppError.unprocessable('Validation failed', messages);
};

// ── Mongoose: Duplicate Key (E11000) ─────────────────────────────────────────
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field';
  const value = err.keyValue?.[field];
  return AppError.conflict(
    `Duplicate value "${value}" for field "${field}". Please use another value.`,
    'DUPLICATE_KEY'
  );
};

// ── JWT: Invalid token ────────────────────────────────────────────────────────
const handleJWTError = () =>
  AppError.unauthorized('Invalid token. Please log in again.');

// ── JWT: Expired token ────────────────────────────────────────────────────────
const handleJWTExpiredError = () =>
  AppError.unauthorized('Your session has expired. Please log in again.');

// ── Error Response Serialiser ────────────────────────────────────────────────
const sendErrorDev = (err, res) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
    statusCode: err.statusCode,
    code: err.code,
    details: err.details,
    stack: err.stack,
    error: err,
  });
};

const sendErrorProd = (err, res) => {
  // Only expose operational errors to the client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      statusCode: err.statusCode,
      code: err.code,
      details: err.details,
    });
  } else {
    // Programmer errors → generic message + alert ops
    logger.error('💥 UNHANDLED PROGRAMMER ERROR', {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again later.',
      statusCode: 500,
    });
  }
};

// ── Main Error Handler ────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Ensure we always have statusCode / isOperational
  if (!(error instanceof AppError)) {
    // Convert known Mongoose / JWT errors to AppError instances
    if (error.name === ERROR_TYPES.CAST) {
      error = handleCastError(error);
    } else if (error.name === ERROR_TYPES.VALIDATION) {
      error = handleValidationError(error);
    } else if (
      error.name === ERROR_TYPES.DUPLICATE_KEY &&
      error.code === MONGOOSE.DUPLICATE_KEY_CODE
    ) {
      error = handleDuplicateKeyError(error);
    } else if (error.name === ERROR_TYPES.JWT) {
      error = handleJWTError();
    } else if (error.name === ERROR_TYPES.JWT_EXPIRED) {
      error = handleJWTExpiredError();
    } else {
      // Unknown error
      error = new AppError(
        error.message || 'Internal server error',
        error.statusCode || 500
      );
      error.isOperational = false;
    }
  }

  // Always log server errors
  if ((error.statusCode || 500) >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl} → ${error.message}`, {
      statusCode: error.statusCode,
      stack: error.stack,
      ip: req.ip,
    });
  } else {
    logger.warn(`[${req.method}] ${req.originalUrl} → ${error.message}`, {
      statusCode: error.statusCode,
    });
  }

  if (isDev()) {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

module.exports = errorHandler;
