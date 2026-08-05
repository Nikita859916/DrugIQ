// ─── routes/index.js ─────────────────────────────────────────────────────────
// Central route registry.
// Import and mount all feature-level routers here.
// The API prefix (e.g. /api/v1) is applied in app.js — not here.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const importRoutes = require('./importRoutes');

const router = express.Router();

// ── Feature Routes ────────────────────────────────────────────────────────────
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/admin', importRoutes);

// ── Placeholder routes (to be implemented) ───────────────────────────────────
// router.use('/drugs',       require('./drugRoutes'));
// router.use('/reviews',     require('./reviewRoutes'));
// router.use('/side-effects',require('./sideEffectRoutes'));
// router.use('/conditions',  require('./conditionRoutes'));
// router.use('/search',      require('./searchRoutes'));
// router.use('/analytics',   require('./analyticsRoutes'));

module.exports = router;
