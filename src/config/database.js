// ─── config/database.js ──────────────────────────────────────────────────────
// Mongoose connection with robust retry logic, event logging, and graceful
// shutdown support. Never import mongoose directly in other modules —
// always go through this module.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');
const logger = require('../utils/logger');

// ── Connection Options ────────────────────────────────────────────────────────
const MONGOOSE_OPTIONS = {
  // Automatically try to reconnect when disconnected
  serverSelectionTimeoutMS: 10_000, // fail fast in dev; increase for prod
  socketTimeoutMS: 45_000,
  // Use the new topology engine
  maxPoolSize: 10,
  minPoolSize: 2,
};

// ── State ────────────────────────────────────────────────────────────────────
let isConnected = false;

// ── Event Listeners ──────────────────────────────────────────────────────────
const registerEvents = () => {
  const { connection } = mongoose;

  connection.on('connected', () => {
    isConnected = true;
    logger.info(`✅ MongoDB connected → ${mongoose.connection.host}/${mongoose.connection.name}`);
  });

  connection.on('disconnected', () => {
    isConnected = false;
    logger.warn('⚠️  MongoDB disconnected');
  });

  connection.on('reconnected', () => {
    isConnected = true;
    logger.info('🔄 MongoDB reconnected');
  });

  connection.on('error', (err) => {
    isConnected = false;
    logger.error(`❌ MongoDB connection error: ${err.message}`);
  });

  // Graceful shutdown
  process.on('SIGINT', gracefulShutdown('SIGINT'));
  process.on('SIGTERM', gracefulShutdown('SIGTERM'));
};

// ── Graceful Shutdown Helper ─────────────────────────────────────────────────
const gracefulShutdown = (signal) => async () => {
  logger.info(`📴 ${signal} received — closing MongoDB connection…`);
  await mongoose.connection.close();
  logger.info('MongoDB connection closed. Exiting process.');
  process.exit(0);
};

// ── Connect ──────────────────────────────────────────────────────────────────
/**
 * Connects to MongoDB using the URI from env.
 * Safe to call multiple times — skips if already connected.
 */
const connectDB = async () => {
  if (isConnected) {
    logger.debug('MongoDB already connected — skipping reconnect');
    return;
  }

  const uri =
    process.env.NODE_ENV === 'test'
      ? process.env.MONGO_TEST_URI
      : process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      'MONGO_URI is not defined. Check your .env file.'
    );
  }

  registerEvents();

  await mongoose.connect(uri, MONGOOSE_OPTIONS);
};

// ── Disconnect (used in tests / scripts) ─────────────────────────────────────
const disconnectDB = async () => {
  if (!isConnected) return;
  await mongoose.connection.close();
  isConnected = false;
  logger.info('MongoDB connection closed manually');
};

// ── Health Check ─────────────────────────────────────────────────────────────
const getDBStatus = () => ({
  status: isConnected ? 'connected' : 'disconnected',
  host: mongoose.connection.host || null,
  name: mongoose.connection.name || null,
  readyState: mongoose.connection.readyState,
});

module.exports = { connectDB, disconnectDB, getDBStatus };
