// ─── utils/cookies.js ────────────────────────────────────────────────────────
// Secure Cookie Utility Helper.
// Handles setting and clearing HTTP-only, secure, SameSite authentication cookies.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { ENV } = require('../constants');

const isProduction = () => process.env.NODE_ENV === ENV.PRODUCTION;

// Cookie expiration defaults
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Base cookie options generator
 * @param {number} maxAge - Cookie maxAge in milliseconds
 * @returns {import('express').CookieOptions}
 */
const getCookieOptions = (maxAge) => ({
  httpOnly: true, // Prevents XSS access to cookies
  secure: isProduction(), // Require HTTPS in production
  sameSite: isProduction() ? 'strict' : 'lax', // CSRF protection
  path: '/',
  maxAge,
});

/**
 * Set Access Token and Refresh Token HTTP-only Cookies
 * @param {import('express').Response} res
 * @param {string} accessToken
 * @param {string} refreshToken
 */
const setAuthCookies = (res, accessToken, refreshToken) => {
  if (accessToken) {
    res.cookie('accessToken', accessToken, getCookieOptions(ACCESS_COOKIE_MAX_AGE));
  }
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, getCookieOptions(REFRESH_COOKIE_MAX_AGE));
  }
};

/**
 * Clear Authentication Cookies (used during logout or account deletion)
 * @param {import('express').Response} res
 */
const clearAuthCookies = (res) => {
  const clearOptions = {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? 'strict' : 'lax',
    path: '/',
  };
  res.clearCookie('accessToken', clearOptions);
  res.clearCookie('refreshToken', clearOptions);
};

module.exports = {
  setAuthCookies,
  clearAuthCookies,
  getCookieOptions,
};
