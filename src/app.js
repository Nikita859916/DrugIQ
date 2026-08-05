// ─── app.js ──────────────────────────────────────────────────────────────────
// Express application factory.
// Creates and configures the Express app with all middleware layers.
// The server binding (port + listen) is handled separately in index.js so
// this module stays testable (no side effects on import).
// ────────────────────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');

// ── Internal Modules ──────────────────────────────────────────────────────────
const corsOptions = require('./config/cors');
const swaggerSpec = require('./config/swagger');
const { globalLimiter } = require('./config/rateLimiter');
const requestLogger = require('./middlewares/requestLogger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');
const { API } = require('./constants');

// ── Create App ────────────────────────────────────────────────────────────────
const app = express();

// ── Trust Proxy (required behind load balancers / Nginx / Heroku) ─────────────
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
  })
);

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// ── Compression ───────────────────────────────────────────────────────────────
app.use(
  compression({
    level: 6,
    threshold: 1024, // Only compress responses > 1 KB
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ── HTTP Request Logging ──────────────────────────────────────────────────────
app.use(requestLogger);

// ── Global Rate Limiter ───────────────────────────────────────────────────────
app.use(globalLimiter);

// ── API Docs (Swagger UI) ──────────────────────────────────────────────────────
if (process.env.SWAGGER_ENABLED !== 'false') {
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { background-color: #1a1a2e; }
      .swagger-ui .topbar-wrapper img { content: url('https://via.placeholder.com/40x40/667eea/ffffff?text=💊'); }
    `,
    customSiteTitle: 'DrugIQ API Docs',
    explorer: true,
  };

  app.use(
    API.DOCS_PATH,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );

  // Raw JSON spec endpoint
  app.get(`${API.DOCS_PATH}.json`, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

// ── API Routes ─────────────────────────────────────────────────────────────────
app.use(API.PREFIX, routes);

// ── Root Info ─────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    name: '💊 DrugIQ API',
    version: '1.0.0',
    description: 'Drug Side Effect & Review Intelligence',
    docs: `${process.env.API_BASE_URL || ''}${API.DOCS_PATH}`,
    health: `${process.env.API_BASE_URL || ''}${API.PREFIX}/health`,
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── 404 Handler (must be after all routes) ────────────────────────────────────
app.use(notFound);

// ── Centralised Error Handler (must be last) ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
