// ─── models/User.js ──────────────────────────────────────────────────────────
// User collection.
// Supports full authentication lifecycle:
//   - Secure bcrypt password hashing (pre-save hook)
//   - Token versioning (invalidates all JWTs on password change)
//   - Email verification flow
//   - Password-reset flow
//   - Role-based access (user | admin)
//   - Soft-delete (isActive flag)
//
// Bookmarks are stored in the dedicated Bookmark collection;
// this schema only caches the count for fast display.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const { Schema } = mongoose;

// ── Constants ────────────────────────────────────────────────────────────────
const SALT_ROUNDS = 12;
const RESET_TOKEN_EXPIRY_HOURS = 1;
const VERIFY_TOKEN_EXPIRY_HOURS = 24;

// ── Schema ───────────────────────────────────────────────────────────────────
const UserSchema = new Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },

    // ── Authentication ────────────────────────────────────────────────────────
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Never returned in queries unless explicitly projected
    },

    /**
     * Incremented on password change.
     * JWTs embed this value — a mismatch invalidates old tokens immediately.
     */
    tokenVersion: {
      type: Number,
      default: 0,
      select: false,
    },

    // ── Role & Access ─────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: {
        values: ['patient', 'pharmacist', 'admin', 'user'],
        message: 'Role must be one of: patient, pharmacist, admin, user',
      },
      default: 'patient',
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ── Email Verification ────────────────────────────────────────────────────
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerifyToken: {
      type: String,
      select: false,
    },

    emailVerifyTokenExpiry: {
      type: Date,
      select: false,
    },

    // ── Password Reset ────────────────────────────────────────────────────────
    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpiry: {
      type: Date,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
      select: false,
    },

    // ── Profile ───────────────────────────────────────────────────────────────
    avatar: {
      type: String,
      default: null,
    },

    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
      trim: true,
      default: null,
    },

    // ── Bookmark Cache ────────────────────────────────────────────────────────
    // Denormalised count — kept in sync by Bookmark model middleware
    bookmarkCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Login Tracking ────────────────────────────────────────────────────────
    lastLoginAt: {
      type: Date,
      default: null,
    },

    loginCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,

    // Transform output: strip internal fields from JSON responses
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.tokenVersion;
        delete ret.emailVerifyToken;
        delete ret.emailVerifyTokenExpiry;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpiry;
        delete ret.passwordChangedAt;
        return ret;
      },
    },

    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ createdAt: -1 });
// Partial index — only index users with a pending reset token
UserSchema.index(
  { passwordResetToken: 1 },
  { sparse: true, name: 'idx_password_reset_token' }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────
UserSchema.virtual('isPasswordResetValid').get(function () {
  return (
    this.passwordResetToken &&
    this.passwordResetExpiry &&
    this.passwordResetExpiry > Date.now()
  );
});

// ── Pre-Save Middleware ────────────────────────────────────────────────────────

/**
 * Hash password before saving (only when modified).
 */
UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);

  // Bump token version whenever password changes (after initial create)
  if (!this.isNew) {
    this.tokenVersion += 1;
    this.passwordChangedAt = new Date();
  }

  return next();
});

/**
 * Exclude soft-deleted users from all find queries automatically.
 */
UserSchema.pre(/^find/, function excludeInactive(next) {
  // Only apply auto-filter if caller hasn't explicitly set isActive
  if (this.getQuery().isActive === undefined) {
    this.where({ isActive: true });
  }
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Compare a plain-text password against the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
UserSchema.methods.comparePassword = async function comparePassword(
  candidatePassword
) {
  return bcrypt.compare(candidatePassword, this.password);
};

/**
 * Generate a secure random password-reset token (plain).
 * Stores the SHA-256 hash on the document and sets expiry.
 * @returns {string} plain token (sent to the user via email)
 */
UserSchema.methods.createPasswordResetToken =
  function createPasswordResetToken() {
    const plainToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');
    this.passwordResetExpiry = new Date(
      Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    );
    return plainToken;
  };

/**
 * Generate a secure email-verification token (plain).
 * @returns {string} plain token
 */
UserSchema.methods.createEmailVerifyToken =
  function createEmailVerifyToken() {
    const plainToken = crypto.randomBytes(32).toString('hex');
    this.emailVerifyToken = crypto
      .createHash('sha256')
      .update(plainToken)
      .digest('hex');
    this.emailVerifyTokenExpiry = new Date(
      Date.now() + VERIFY_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
    );
    return plainToken;
  };

/**
 * Clear all password-reset fields after a successful reset.
 */
UserSchema.methods.clearPasswordReset = function clearPasswordReset() {
  this.passwordResetToken = undefined;
  this.passwordResetExpiry = undefined;
};

/**
 * Check whether a JWT (identified by its iat claim) was issued
 * before the last password change — if so, it must be rejected.
 * @param {number} jwtIssuedAt - Unix timestamp (seconds)
 * @returns {boolean} true if the token was issued before the password change
 */
UserSchema.methods.wasPasswordChangedAfter =
  function wasPasswordChangedAfter(jwtIssuedAt) {
    if (!this.passwordChangedAt) return false;
    const changedTimestamp = Math.floor(
      this.passwordChangedAt.getTime() / 1000
    );
    return jwtIssuedAt < changedTimestamp;
  };

/**
 * Record a successful login.
 */
UserSchema.methods.recordLogin = function recordLogin() {
  this.lastLoginAt = new Date();
  this.loginCount += 1;
};

// ── Static Methods ────────────────────────────────────────────────────────────

/**
 * Find a user by their email (includes password field for auth checks).
 * @param {string} email
 * @returns {Promise<User|null>}
 */
UserSchema.statics.findByEmailWithPassword = function findByEmailWithPassword(
  email
) {
  return this.findOne({ email: email.toLowerCase().trim() })
    .select('+password +tokenVersion')
    .exec();
};

/**
 * Find a user by a hashed reset token that hasn't expired yet.
 * @param {string} plainToken
 * @returns {Promise<User|null>}
 */
UserSchema.statics.findByResetToken = function findByResetToken(plainToken) {
  const hashed = crypto
    .createHash('sha256')
    .update(plainToken)
    .digest('hex');

  return this.findOne({
    passwordResetToken: hashed,
    passwordResetExpiry: { $gt: Date.now() },
  })
    .select('+passwordResetToken +passwordResetExpiry +passwordChangedAt +tokenVersion')
    .exec();
};

const User = mongoose.model('User', UserSchema);

module.exports = User;
