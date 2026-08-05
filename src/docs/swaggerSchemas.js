// ─── docs/swaggerSchemas.js ──────────────────────────────────────────────────
// Additional OpenAPI schema definitions using JSDoc annotations.
// swagger-jsdoc picks these up automatically via the apis glob in config/swagger.js
// ────────────────────────────────────────────────────────────────────────────

'use strict';

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     # ── Drug ────────────────────────────────────────────────────────────────
 *     Drug:
 *       type: object
 *       required:
 *         - name
 *         - conditions
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1e5b8a3c12d4e5f6a7b8c"
 *         name:
 *           type: string
 *           example: "Metformin"
 *         genericName:
 *           type: string
 *           example: "Metformin Hydrochloride"
 *         conditions:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Type 2 Diabetes", "PCOS"]
 *         sideEffects:
 *           type: array
 *           items:
 *             type: string
 *           example: ["nausea", "diarrhoea", "headache"]
 *         averageRating:
 *           type: number
 *           format: float
 *           minimum: 1
 *           maximum: 10
 *           example: 7.4
 *         reviewCount:
 *           type: integer
 *           example: 3142
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     # ── Review ──────────────────────────────────────────────────────────────
 *     Review:
 *       type: object
 *       required:
 *         - drugName
 *         - condition
 *         - review
 *         - rating
 *       properties:
 *         _id:
 *           type: string
 *           example: "64f1e5b8a3c12d4e5f6a7b8d"
 *         drugName:
 *           type: string
 *           example: "Metformin"
 *         condition:
 *           type: string
 *           example: "Type 2 Diabetes"
 *         review:
 *           type: string
 *           example: "Really helped control my blood sugar with minimal side effects."
 *         rating:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           example: 8
 *         usefulCount:
 *           type: integer
 *           example: 42
 *         date:
 *           type: string
 *           format: date
 *           example: "2023-07-15"
 *         sentimentScore:
 *           type: number
 *           format: float
 *           description: "NLP-computed sentiment score (-1 to 1)"
 *           example: 0.72
 *         createdAt:
 *           type: string
 *           format: date-time
 *
 *     # ── Side Effect ─────────────────────────────────────────────────────────
 *     SideEffect:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         drugName:
 *           type: string
 *           example: "Metformin"
 *         effect:
 *           type: string
 *           example: "nausea"
 *         frequency:
 *           type: integer
 *           description: "Number of reviews mentioning this side effect"
 *           example: 312
 *         severity:
 *           type: string
 *           enum: [mild, moderate, severe]
 *           example: "mild"
 *
 *     # ── Condition ───────────────────────────────────────────────────────────
 *     Condition:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Type 2 Diabetes"
 *         relatedDrugs:
 *           type: array
 *           items:
 *             type: string
 *           example: ["Metformin", "Glipizide", "Insulin Glargine"]
 *         reviewCount:
 *           type: integer
 *           example: 18450
 */

// This file is intentionally empty at runtime — annotations are processed by swagger-jsdoc.
module.exports = {};
