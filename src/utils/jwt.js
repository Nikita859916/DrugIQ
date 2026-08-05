// ─── utils/jwt.js ────────────────────────────────────────────────────────────
// JWT Utility helper.
// Generates, verifies, and decodes Access Tokens & Refresh Tokens.
// Includes user ID, role, and tokenVersion in payloads.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

const DEFAULT_ACCESS_SECRET = 'drugiq_access_super_secret_key_change_in_production_32bytes';
const DEFAULT_REFRESH_SECRET = 'drugiq_refresh_super_secret_key_change_in_production_32bytes';

const getAccessSecret = () => process.env.JWT_ACCESS_SECRET || DEFAULT_ACCESS_SECRET;
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || DEFAULT_REFRESH_SECRET;

const getAccessExpiry = () => process.env.JWT_ACCESS_EXPIRATION || '15m';
const getRefreshExpiry = () => process.env.JWT_REFRESH_EXPIRATION || '7d';

/**
 * Generate Access Token
 * @param {object} payload - { id, role, tokenVersion }
 * @returns {string} Signed JWT Access Token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      id: payload.id || payload._id,
      role: payload.role,
      tokenVersion: payload.tokenVersion ?? 0,
      type: 'access',
    },
    getAccessSecret(),
    { expiresIn: getAccessExpiry() }
  );
};

/**
 * Generate Refresh Token
 * @param {object} payload - { id, tokenVersion }
 * @returns {string} Signed JWT Refresh Token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(
    {
      id: payload.id || payload._id,
      tokenVersion: payload.tokenVersion ?? 0,
      type: 'refresh',
    },
    getRefreshSecret(),
    { expiresIn: getRefreshExpiry() }
  );
};

/**
 * Verify Access Token
 * @param {string} token
 * @returns {object} Decoded token payload
 */
const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, getAccessSecret());
    if (decoded.type !== 'access') {
      throw AppError.unauthorized('Invalid token type', 'INVALID_TOKEN_TYPE');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Access token expired', 'TOKEN_EXPIRED');
    }
    throw AppError.unauthorized('Invalid access token', 'INVALID_TOKEN');
  }
};

/**
 * Verify Refresh Token
 * @param {string} token
 * @returns {object} Decoded token payload
 */
const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, getRefreshSecret());
    if (decoded.type !== 'refresh') {
      throw AppError.unauthorized('Invalid token type', 'INVALID_TOKEN_TYPE');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err.name === 'TokenExpiredError') {
      throw AppError.unauthorized('Refresh token expired. Please log in again', 'REFRESH_TOKEN_EXPIRED');
    }
    throw AppError.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }
};

/**
 * Decode JWT without verifying signature
 * @param {string} token
 * @returns {object|null}
 */
const decodeToken = (token) => {
  return jwt.decode(token);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
