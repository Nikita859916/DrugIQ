// ─── utils/logger.js ────────────────────────────────────────────────────────
// Winston logger with daily-rotating file transports.
// Exports a singleton logger instance — import this everywhere.
//
// Log levels (highest → lowest priority):
//   error | warn | info | http | verbose | debug | silly
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');
const { LOG, ENV } = require('../constants');

// ── Resolve log directory ────────────────────────────────────────────────────
const LOG_DIR = path.resolve(
  process.cwd(),
  process.env.LOG_DIR || LOG.DATE_PATTERN
);

// ── Custom timestamp format ──────────────────────────────────────────────────
const TIMESTAMP_FORMAT = 'YYYY-MM-DD HH:mm:ss';

// ── Console format (colourised, human-readable) ──────────────────────────────
const consoleFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: TIMESTAMP_FORMAT }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const extras = Object.keys(meta).length
      ? `\n${JSON.stringify(meta, null, 2)}`
      : '';
    return `[${timestamp}] ${level}: ${message}${extras}`;
  })
);

// ── File format (structured JSON) ────────────────────────────────────────────
const fileFormat = format.combine(
  format.timestamp({ format: TIMESTAMP_FORMAT }),
  format.errors({ stack: true }),
  format.json()
);

// ── Shared rotate options ────────────────────────────────────────────────────
const rotateOptions = {
  dirname: LOG_DIR,
  datePattern: LOG.DATE_PATTERN,
  zippedArchive: true,
  maxSize: LOG.MAX_SIZE,
  maxFiles: LOG.MAX_FILES,
  format: fileFormat,
};

// ── Build transports array ────────────────────────────────────────────────────
const buildTransports = () => {
  const list = [];

  // Always write errors to a dedicated file
  list.push(
    new transports.DailyRotateFile({
      ...rotateOptions,
      filename: 'error-%DATE%.log',
      level: 'error',
    })
  );

  // Combined log for everything at the configured level
  list.push(
    new transports.DailyRotateFile({
      ...rotateOptions,
      filename: 'combined-%DATE%.log',
    })
  );

  // Console only in non-production (or when LOG_LEVEL is debug)
  if (
    process.env.NODE_ENV !== ENV.PRODUCTION ||
    process.env.LOG_LEVEL === 'debug'
  ) {
    list.push(
      new transports.Console({
        format: consoleFormat,
      })
    );
  }

  return list;
};

// ── Logger singleton ─────────────────────────────────────────────────────────
const logger = createLogger({
  level: process.env.LOG_LEVEL || LOG.DEFAULT_LEVEL,
  defaultMeta: {
    service: 'drugiq-api',
    env: process.env.NODE_ENV || ENV.DEVELOPMENT,
  },
  transports: buildTransports(),
  exitOnError: false,
  silent: process.env.NODE_ENV === ENV.TEST,
});

// ── Stream for Morgan HTTP middleware ─────────────────────────────────────────
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
