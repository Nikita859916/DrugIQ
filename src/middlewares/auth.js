// ─── middlewares/auth.js ──────────────────────────────────────────────────────
// JWT Protection Middleware.
// Extracts and verifies JWT from Bearer Header or HTTP-only Cookie.
// Validates User existence, active status, tokenVersion, and password changed date.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { User } = require('../models');
const { verifyAccessToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Protect Middleware
 * Ensures request contains a valid, active Access Token and attaches user to req.user.
 */
const protect = asyncHandler(async (req, _res, next) => {
  let token;

  // 1. Check Authorization header (Bearer <token>)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Fallback to HTTP-only cookie (accessToken)
  else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw AppError.unauthorized(
      'Authentication required. Please log in to access this resource.',
      'NO_TOKEN_PROVIDED'
    );
  }

  // 3. Verify JWT signature & expiration
  const decoded = verifyAccessToken(token);

  // 4. Fetch User from database (include tokenVersion & passwordChangedAt)
  const currentUser = await User.findById(decoded.id)
    .select('+tokenVersion +passwordChangedAt')
    .exec();

  if (!currentUser) {
    throw AppError.unauthorized(
      'The user belonging to this token no longer exists.',
      'USER_NOT_FOUND'
    );
  }

  if (!currentUser.isActive) {
    throw AppError.unauthorized(
      'Your account has been deactivated. Please contact support.',
      'ACCOUNT_DEACTIVATED'
    );
  }

  // 5. Verify tokenVersion match (invalidates tokens when password or security settings change)
  if (
    decoded.tokenVersion !== undefined &&
    decoded.tokenVersion !== currentUser.tokenVersion
  ) {
    throw AppError.unauthorized(
      'Token is no longer valid due to security setting updates. Please log in again.',
      'TOKEN_VERSION_MISMATCH'
    );
  }

  // 6. Verify if user changed password after the token was issued
  if (currentUser.wasPasswordChangedAfter(decoded.iat)) {
    throw AppError.unauthorized(
      'User recently changed password. Please log in again.',
      'PASSWORD_CHANGED_RECENTLY'
    );
  }

  // 7. Attach user to request object
  req.user = currentUser;
  next();
});

module.exports = { protect };
