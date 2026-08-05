// ─── config/swagger.js ──────────────────────────────────────────────────────
// Swagger / OpenAPI 3.0 configuration using swagger-jsdoc.
// API docs are served at /api/docs when SWAGGER_ENABLED=true.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const swaggerJsdoc = require('swagger-jsdoc');
const { API } = require('../constants');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: '💊 DrugIQ API',
      version: '1.0.0',
      description: `
## DrugIQ – Drug Side Effect & Review Intelligence

A production-grade healthcare REST API that provides:
- **Drug reviews** analysis across 215,000+ patient reviews
- **Side effect** reporting and aggregation
- **Condition-based** drug recommendation endpoints
- **Sentiment intelligence** powered by NLP

> ⚠️ This API is for informational purposes only and does not constitute medical advice.
      `,
      contact: {
        name: 'DrugIQ Team',
        email: 'api@drugiq.health',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `${process.env.API_BASE_URL || 'http://localhost:5000'}${API.PREFIX}`,
        description: 'Development Server',
      },
      {
        url: `https://api.drugiq.health${API.PREFIX}`,
        description: 'Production Server',
      },
    ],
    components: {
      schemas: {
        // ── Shared Schemas ──────────────────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Request successful' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Something went wrong' },
            statusCode: { type: 'integer', example: 500 },
            stack: {
              type: 'string',
              description: 'Only present in development mode',
            },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 215063 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 10754 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            environment: { type: 'string', example: 'development' },
            uptime: { type: 'number', example: 3600.54 },
            timestamp: { type: 'string', format: 'date-time' },
            database: {
              type: 'object',
              properties: {
                status: { type: 'string', example: 'connected' },
                host: { type: 'string', example: 'localhost' },
                name: { type: 'string', example: 'drugiq' },
              },
            },
            memory: {
              type: 'object',
              properties: {
                heapUsed: { type: 'string', example: '45.2 MB' },
                heapTotal: { type: 'string', example: '128 MB' },
                rss: { type: 'string', example: '78.4 MB' },
              },
            },
          },
        },
      },
      responses: {
        NotFound: {
          description: 'The requested resource was not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        BadRequest: {
          description: 'Invalid request parameters',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        InternalError: {
          description: 'Unexpected server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
      parameters: {
        PageParam: {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number (1-based)',
        },
        LimitParam: {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Number of results per page (max 100)',
        },
        SortParam: {
          in: 'query',
          name: 'sort',
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          description: 'Sort direction',
        },
      },
    },
    tags: [
      { name: 'Health', description: 'API health & status endpoints' },
      { name: 'Drugs', description: 'Drug information & search' },
      { name: 'Reviews', description: 'Patient reviews & ratings' },
      { name: 'Side Effects', description: 'Side effect reporting & aggregation' },
      { name: 'Conditions', description: 'Medical conditions & related drugs' },
    ],
  },
  // Paths to files with JSDoc @swagger / @openapi annotations
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/docs/*.js',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
