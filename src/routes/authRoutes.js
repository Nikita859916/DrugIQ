// ─── routes/authRoutes.js ─────────────────────────────────────────────────────
// Authentication & Profile Routes.
// Mounts validators, rate limiters, protection middleware, and controllers.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const {
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
} = require('../controllers/authController');

const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');
const {
  loginLimiter,
  registerLimiter,
  passwordResetLimiter,
} = require('../middlewares/authRateLimiter');

const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  validateDeleteAccount,
} = require('../middlewares/authValidation');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication & Profile Management Endpoints
 */

// ── Public Routes ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string, example: "Dr. Sarah Connor" }
 *               email: { type: string, example: "sarah@drugiq.health" }
 *               password: { type: string, example: "SecurePass123!" }
 *               role: { type: string, enum: [patient, pharmacist, admin, user], example: "pharmacist" }
 *               bio: { type: string, example: "Clinical Pharmacist specializing in oncology" }
 *     responses:
 *       201:
 *         description: User registered successfully
 */
router.post('/register', registerLimiter, validateRegister, register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, example: "sarah@drugiq.health" }
 *               password: { type: string, example: "SecurePass123!" }
 *     responses:
 *       200:
 *         description: Logged in successfully
 */
router.post('/login', loginLimiter, validateLogin, login);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh Access Token
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: New Access and Refresh Token generated
 */
router.post('/refresh-token', refreshToken);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: "sarah@drugiq.health" }
 *     responses:
 *       200:
 *         description: Reset token generated
 */
router.post(
  '/forgot-password',
  passwordResetLimiter,
  validateForgotPassword,
  forgotPassword
);

/**
 * @swagger
 * /auth/reset-password/{token}:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newPassword]
 *             properties:
 *               newPassword: { type: string, example: "NewSecurePass123!" }
 *     responses:
 *       200:
 *         description: Password reset successful
 */
router.post(
  '/reset-password/:token',
  passwordResetLimiter,
  validateResetPassword,
  resetPassword
);

// ── Protected Routes (Require Authentication) ─────────────────────────────────

router.use(protect); // All routes below require valid JWT authentication

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out current user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', logout);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Profile retrieved
 *   patch:
 *     summary: Update profile details
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Profile updated
 *   delete:
 *     summary: Delete account
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.get('/me', getProfile);
router.patch('/me', validateUpdateProfile, updateProfile);
router.delete('/me', validateDeleteAccount, deleteAccount);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change password for logged-in user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post('/change-password', validateChangePassword, changePassword);

// ── Role Authorization Example Endpoint ──────────────────────────────────────
/**
 * @swagger
 * /auth/admin-only:
 *   get:
 *     summary: Admin restricted test route
 *     tags: [Auth]
 */
router.get('/admin-only', restrictTo('admin'), (req, res) => {
  res.json({
    success: true,
    message: 'Welcome Admin! Authorized access granted.',
    user: req.user,
  });
});

module.exports = router;
