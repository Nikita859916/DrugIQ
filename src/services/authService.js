// ─── services/authService.js ──────────────────────────────────────────────────
// Authentication & Profile Business Logic Service.
// Completely decoupled from Express req/res handling.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { User } = require('../models');
const AppError = require('../utils/AppError');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require('../utils/jwt');

class AuthService {
  /**
   * Register a new user
   * @param {object} registerData - { name, email, password, role, bio, avatar }
   * @returns {Promise<{ user: User, accessToken: string, refreshToken: string }>}
   */
  static async register({ name, email, password, role, bio, avatar }) {
    const normalisedEmail = email.toLowerCase().trim();

    // 1. Prevent duplicate email registration
    const existingUser = await User.findOne({ email: normalisedEmail });
    if (existingUser) {
      throw AppError.conflict(
        'An account with this email address already exists.',
        'EMAIL_EXISTS'
      );
    }

    // 2. Create new user document (password hashed in User pre-save hook)
    const user = new User({
      name,
      email: normalisedEmail,
      password,
      role: role || 'patient',
      bio: bio || null,
      avatar: avatar || null,
    });

    await user.save();

    // 3. Issue tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  /**
   * Login existing user
   * @param {object} loginData - { email, password }
   * @returns {Promise<{ user: User, accessToken: string, refreshToken: string }>}
   */
  static async login({ email, password }) {
    const normalisedEmail = email.toLowerCase().trim();

    // 1. Find user by email (explicitly project password and tokenVersion)
    const user = await User.findByEmailWithPassword(normalisedEmail);
    if (!user) {
      throw AppError.unauthorized(
        'Invalid email address or password.',
        'INVALID_CREDENTIALS'
      );
    }

    // 2. Verify account is active
    if (!user.isActive) {
      throw AppError.unauthorized(
        'Your account has been deactivated. Please contact support.',
        'ACCOUNT_DEACTIVATED'
      );
    }

    // 3. Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw AppError.unauthorized(
        'Invalid email address or password.',
        'INVALID_CREDENTIALS'
      );
    }

    // 4. Record login activity
    user.recordLogin();
    await user.save();

    // 5. Issue tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  /**
   * Refresh Access & Refresh Tokens using a valid Refresh Token
   * @param {string} refreshTokenString
   * @returns {Promise<{ accessToken: string, refreshToken: string, user: User }>}
   */
  static async refreshToken(refreshTokenString) {
    if (!refreshTokenString) {
      throw AppError.unauthorized(
        'Refresh token is required',
        'NO_REFRESH_TOKEN'
      );
    }

    // 1. Verify Refresh Token JWT signature & expiration
    const decoded = verifyRefreshToken(refreshTokenString);

    // 2. Fetch User
    const user = await User.findById(decoded.id)
      .select('+tokenVersion +passwordChangedAt')
      .exec();

    if (!user || !user.isActive) {
      throw AppError.unauthorized(
        'User belonging to this token no longer exists or is inactive',
        'USER_INACTIVE'
      );
    }

    // 3. Verify tokenVersion (invalidates old refresh tokens)
    if (decoded.tokenVersion !== user.tokenVersion) {
      throw AppError.unauthorized(
        'Refresh token has been revoked due to security updates. Please log in again.',
        'REFRESH_TOKEN_REVOKED'
      );
    }

    // 4. Generate fresh token pair
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return { accessToken, refreshToken, user };
  }

  /**
   * Get User Profile by ID
   * @param {string} userId
   * @returns {Promise<User>}
   */
  static async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound('User profile');
    }
    return user;
  }

  /**
   * Update User Profile
   * @param {string} userId
   * @param {object} updateData - { name, bio, avatar }
   * @returns {Promise<User>}
   */
  static async updateProfile(userId, updateData) {
    const allowedFields = ['name', 'bio', 'avatar'];
    const filteredUpdates = {};

    Object.keys(updateData).forEach((key) => {
      if (allowedFields.includes(key) && updateData[key] !== undefined) {
        filteredUpdates[key] = updateData[key];
      }
    });

    const user = await User.findByIdAndUpdate(userId, filteredUpdates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw AppError.notFound('User');
    }

    return user;
  }

  /**
   * Change Password for Authenticated User
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<{ user: User, accessToken: string, refreshToken: string }>}
   */
  static async changePassword(userId, currentPassword, newPassword) {
    // 1. Fetch user with password
    const user = await User.findById(userId).select('+password +tokenVersion');
    if (!user) {
      throw AppError.notFound('User');
    }

    // 2. Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw AppError.badRequest(
        'Your current password is incorrect.',
        'INCORRECT_CURRENT_PASSWORD'
      );
    }

    // 3. Set new password (pre-save hook hashes password and increments tokenVersion)
    user.password = newPassword;
    await user.save();

    // 4. Issue new token pair
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  /**
   * Generate Password Reset Token (Token generation step)
   * @param {string} email
   * @returns {Promise<{ resetToken: string, user: User }>}
   */
  static async forgotPassword(email) {
    const normalisedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalisedEmail });

    if (!user) {
      throw AppError.notFound('No account registered with this email address');
    }

    // Generate token and save to document
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    return { resetToken, user };
  }

  /**
   * Reset Password using valid Reset Token
   * @param {string} plainToken
   * @param {string} newPassword
   * @returns {Promise<{ user: User, accessToken: string, refreshToken: string }>}
   */
  static async resetPassword(plainToken, newPassword) {
    // 1. Find user by hashed reset token (checks expiry automatically)
    const user = await User.findByResetToken(plainToken);
    if (!user) {
      throw AppError.badRequest(
        'Password reset token is invalid or has expired. Please request a new one.',
        'INVALID_RESET_TOKEN'
      );
    }

    // 2. Update password and clear reset token fields
    user.password = newPassword;
    user.clearPasswordReset();

    // 3. Save (pre-save hook hashes new password & bumps tokenVersion)
    await user.save();

    // 4. Issue new tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return { user, accessToken, refreshToken };
  }

  /**
   * Delete User Account (Soft-delete with password confirmation)
   * @param {string} userId
   * @param {string} password
   * @returns {Promise<void>}
   */
  static async deleteAccount(userId, password) {
    const user = await User.findById(userId).select('+password +tokenVersion');
    if (!user) {
      throw AppError.notFound('User');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw AppError.badRequest(
        'Incorrect password. Account deletion aborted.',
        'INCORRECT_PASSWORD'
      );
    }

    // Soft-delete account and bump token version to revoke existing JWTs
    user.isActive = false;
    user.tokenVersion += 1;
    await user.save({ validateBeforeSave: false });
  }
}

module.exports = AuthService;
