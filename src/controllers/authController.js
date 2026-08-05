// ─── controllers/authController.js ───────────────────────────────────────────
// Authentication & Profile Controller.
// Receives Express HTTP requests, calls AuthService, manages HTTP cookies, and
// sends standardized JSON responses.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const AuthService = require('../services/authService');
const { sendSuccess, sendCreated, sendNoContent } = require('../utils/apiResponse');
const { setAuthCookies, clearAuthCookies } = require('../utils/cookies');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, bio, avatar } = req.body;

  const { user, accessToken, refreshToken } = await AuthService.register({
    name,
    email,
    password,
    role,
    bio,
    avatar,
  });

  // Set HTTP-only cookies
  setAuthCookies(res, accessToken, refreshToken);

  sendCreated(
    res,
    {
      user,
      accessToken,
      refreshToken,
    },
    'User registered successfully'
  );
});

/**
 * @desc    Log in an existing user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, accessToken, refreshToken } = await AuthService.login({
    email,
    password,
  });

  // Set HTTP-only cookies
  setAuthCookies(res, accessToken, refreshToken);

  sendSuccess(res, {
    message: 'Logged in successfully',
    data: {
      user,
      accessToken,
      refreshToken,
    },
  });
});

/**
 * @desc    Log out current user and clear auth cookies
 * @route   POST /api/v1/auth/logout
 * @access  Private (Authenticated)
 */
const logout = asyncHandler(async (_req, res) => {
  clearAuthCookies(res);

  sendSuccess(res, {
    message: 'Logged out successfully',
    data: null,
  });
});

/**
 * @desc    Refresh Access & Refresh Tokens
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public (uses Refresh Token from cookie or body)
 */
const refreshToken = asyncHandler(async (req, res) => {
  // Read refresh token from HTTP-only cookie or request body
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  const { accessToken, refreshToken: newRefreshToken, user } =
    await AuthService.refreshToken(token);

  // Set updated cookies
  setAuthCookies(res, accessToken, newRefreshToken);

  sendSuccess(res, {
    message: 'Token refreshed successfully',
    data: {
      accessToken,
      refreshToken: newRefreshToken,
      user,
    },
  });
});

/**
 * @desc    Get currently logged-in user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getProfile = asyncHandler(async (req, res) => {
  const user = await AuthService.getProfile(req.user._id || req.user.id);

  sendSuccess(res, {
    message: 'Profile retrieved successfully',
    data: { user },
  });
});

/**
 * @desc    Update user profile details
 * @route   PATCH /api/v1/auth/me
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const updatedUser = await AuthService.updateProfile(
    req.user._id || req.user.id,
    req.body
  );

  sendSuccess(res, {
    message: 'Profile updated successfully',
    data: { user: updatedUser },
  });
});

/**
 * @desc    Change password for logged-in user
 * @route   POST /api/v1/auth/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const { user, accessToken, refreshToken: newRefreshToken } =
    await AuthService.changePassword(
      req.user._id || req.user.id,
      currentPassword,
      newPassword
    );

  // Re-issue updated cookies
  setAuthCookies(res, accessToken, newRefreshToken);

  sendSuccess(res, {
    message: 'Password changed successfully. New session tokens issued.',
    data: {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

/**
 * @desc    Forgot Password — generate password reset token
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const { resetToken, user } = await AuthService.forgotPassword(email);

  // Return reset token in response (ready for email service integration)
  sendSuccess(res, {
    message:
      'Password reset token generated successfully. In production, this is sent via email.',
    data: {
      email: user.email,
      resetToken,
    },
  });
});

/**
 * @desc    Reset password using reset token
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  const { user, accessToken, refreshToken: newRefreshToken } =
    await AuthService.resetPassword(token, newPassword);

  // Set new session cookies
  setAuthCookies(res, accessToken, newRefreshToken);

  sendSuccess(res, {
    message: 'Password reset successful. You are now logged in.',
    data: {
      user,
      accessToken,
      refreshToken: newRefreshToken,
    },
  });
});

/**
 * @desc    Delete (deactivate) account
 * @route   DELETE /api/v1/auth/me
 * @access  Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const { password } = req.body;

  await AuthService.deleteAccount(req.user._id || req.user.id, password);

  // Clear authentication cookies
  clearAuthCookies(res);

  sendSuccess(res, {
    message: 'Account deleted/deactivated successfully',
    data: null,
  });
});

module.exports = {
  register,
  login,
  logout,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteAccount,
};
