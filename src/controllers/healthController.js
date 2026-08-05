// ─── controllers/healthController.js ─────────────────────────────────────────
// Health-check endpoint controller.
// Returns process uptime, memory usage, DB status, and env metadata.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { getDBStatus } = require('../config/database');
const { sendSuccess } = require('../utils/apiResponse');

/**
 * GET /api/health
 * Returns server + database health information.
 *
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     description: Returns the health status of the API server and MongoDB connection.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
const healthCheck = (_req, res) => {
  const memBytes = process.memoryUsage();
  const toMB = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;

  sendSuccess(res, {
    message: '✅ DrugIQ API is healthy',
    data: {
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: getDBStatus(),
      memory: {
        heapUsed: toMB(memBytes.heapUsed),
        heapTotal: toMB(memBytes.heapTotal),
        rss: toMB(memBytes.rss),
        external: toMB(memBytes.external),
      },
      node: process.version,
    },
  });
};

module.exports = { healthCheck };
