// ─── middlewares/authValidation.js ────────────────────────────────────────────
// Express-Validator middleware for authentication and profile management routes.
// Validates all input schemas and formats consistent validation error responses.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { body, param, validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Validation error handler middleware
 * Formats express-validator results into clean AppError response.
 */
const validateResult = (req, _res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    return next(
      AppError.unprocessable('Input validation failed', formattedErrors)
    );
  }
  next();
};

// ── Validation Schemas ───────────────────────────────────────────────────────

/**
 * Registration Validation Rules
 */
const validateRegister = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  body('role')
    .optional()
    .trim()
    .isIn(['patient', 'pharmacist', 'admin', 'user'])
    .withMessage('Role must be one of: patient, pharmacist, admin, user'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  validateResult,
];

/**
 * Login Validation Rules
 */
const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password').notEmpty().withMessage('Password is required'),

  validateResult,
];

/**
 * Update Profile Validation Rules
 */
const validateUpdateProfile = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),

  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),

  body('avatar')
    .optional()
    .trim()
    .isString()
    .withMessage('Avatar must be a valid URL string'),

  validateResult,
];

/**
 * Change Password Validation Rules
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from current password');
      }
      return true;
    }),

  validateResult,
];

/**
 * Forgot Password Validation Rules
 */
const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  validateResult,
];

/**
 * Reset Password Validation Rules
 */
const validateResetPassword = [
  param('token').notEmpty().withMessage('Reset token is required in URL parameter'),

  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      'New password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),

  validateResult,
];

/**
 * Delete Account Validation Rules
 */
const validateDeleteAccount = [
  body('password')
    .notEmpty()
    .withMessage('Password confirmation is required to delete your account'),

  validateResult,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateDeleteAccount,
};
