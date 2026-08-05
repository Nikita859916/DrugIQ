// ─── index.js ────────────────────────────────────────────────────────────────
// Application entry point.
// Bootstraps the database connection, then starts the HTTP server.
// Handles uncaught exceptions and unhandled rejections to prevent crashes.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

// Load .env before importing anything that reads process.env
require('dotenv').config();

const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/database');
const logger = require('./utils/logger');

// ── Configuration ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 5000;
const HOST = process.env.HOST || 'localhost';
const ENV = process.env.NODE_ENV || 'development';

// ── Create HTTP server ────────────────────────────────────────────────────────
const server = http.createServer(app);

// ── Graceful Shutdown ──────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.info(`\n📴 ${signal} received. Shutting down gracefully…`);

  server.close((err) => {
    if (err) {
      logger.error('Error during server shutdown', { error: err.message });
      process.exit(1);
    }
    logger.info('✅ HTTP server closed.');
    process.exit(0);
  });

  // Force-quit after 10 seconds if connections are hanging
  setTimeout(() => {
    logger.error('⏱️  Forced shutdown after timeout (10s)');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ── Global Error Safety Net ────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('💥 Uncaught Exception — process will exit', {
    message: err.message,
    stack: err.stack,
  });
  // Give the logger time to flush, then exit
  setTimeout(() => process.exit(1), 500).unref();
});

process.on('unhandledRejection', (reason) => {
  logger.error('💥 Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  // In production, let the process manager (PM2 / Docker) restart
  if (ENV === 'production') {
    setTimeout(() => process.exit(1), 500).unref();
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const bootstrap = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Start HTTP server
    server.listen(PORT, HOST, () => {
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info(`  💊 DrugIQ API  ·  ${ENV.toUpperCase()}`);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info(`  🚀 Server   → http://${HOST}:${PORT}`);
      logger.info(`  📖 Docs     → http://${HOST}:${PORT}/api/docs`);
      logger.info(`  ❤️  Health   → http://${HOST}:${PORT}/api/v1/health`);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });
  } catch (err) {
    logger.error(`❌ Failed to bootstrap server: ${err.message}`, {
      stack: err.stack,
    });
    process.exit(1);
  }
};

bootstrap();
