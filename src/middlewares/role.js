// ─── middlewares/role.js ──────────────────────────────────────────────────────
// Role-Based Authorization Middleware.
// Restricts access to endpoints based on user roles (patient, pharmacist, admin).
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const AppError = require('../utils/AppError');

/**
 * Role Authorization Middleware Factory
 * Accepts allowed roles (e.g. restrictTo('admin', 'pharmacist')) and returns middleware.
 *
 * @param {...string} allowedRoles - List of allowed roles: 'patient', 'pharmacist', 'admin', 'user'
 * @returns {import('express').RequestHandler}
 *
 * @example
 * router.get('/admin-dashboard', protect, restrictTo('admin'), getAdminStats);
 * router.post('/prescription', protect, restrictTo('pharmacist', 'admin'), addPrescription);
 */
const restrictTo = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(
        AppError.unauthorized('Authentication required before authorization check')
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Role "${req.user.role}" is not authorized to perform this action.`,
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
};

module.exports = { restrictTo };
