// ─── routes/healthRoutes.js ──────────────────────────────────────────────────
// Health-check route — no rate limiting applied here.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const { healthCheck } = require('../controllers/healthController');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Health
 *     description: API health & status endpoints
 */

router.get('/', healthCheck);

module.exports = router;
