// ─── routes/importRoutes.js ───────────────────────────────────────────────────
// Dataset Import Admin Routes.
// Protected endpoints for dataset seeding and administrative maintenance.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const express = require('express');
const { importDataset } = require('../controllers/importController');
const { protect } = require('../middlewares/authMiddleware');
const { restrictTo } = require('../middlewares/roleMiddleware');

const router = express.Router();

// Protect all admin import routes with JWT + Admin role check
router.use(protect);
router.use(restrictTo('admin'));

/**
 * @swagger
 * tags:
 *   name: Admin / Import
 *   description: Administrative dataset import and maintenance endpoints
 */

/**
 * @swagger
 * /admin/import-dataset:
 *   post:
 *     summary: Trigger Kaggle Drug Reviews Dataset Import (Admin Only)
 *     tags: [Admin / Import]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               filePath:
 *                 type: string
 *                 description: Relative or absolute path to CSV file
 *                 example: "src/seed/data/drugsComTrain_raw.csv"
 *               batchSize:
 *                 type: integer
 *                 default: 1000
 *                 example: 1000
 *               resume:
 *                 type: boolean
 *                 default: true
 *                 description: Skip duplicate reviews if re-running
 *               source:
 *                 type: string
 *                 default: "kaggle_train"
 *                 example: "kaggle_train"
 *     responses:
 *       200:
 *         description: Import complete with summary statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin role required)
 */
router.post('/import-dataset', importDataset);

module.exports = router;
