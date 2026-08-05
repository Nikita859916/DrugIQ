// ─── seed/index.js ───────────────────────────────────────────────────────────
// CLI Seed Runner for DrugIQ Backend.
// Executes dataset import pipeline from terminal with live progress reporting.
//
// Usage:
//   npm run seed
//   npm run seed -- --file=src/seed/data/drugsComTest_raw.csv
//   npm run seed:clear
// ────────────────────────────────────────────────────────────────────────────

'use strict';

require('dotenv').config();

const path = require('path');
const { connectDB, disconnectDB } = require('../config/database');
const ImportService = require('../services/importService');
const { Drug, Review } = require('../models');
const logger = require('../utils/logger');

// ── CLI Arguments Parsing ───────────────────────────────────────────────────
const args = process.argv.slice(2);
const IS_CLEAR_ONLY = args.includes('--clear');

const fileArg = args.find((a) => a.startsWith('--file='));
const CUSTOM_FILE_PATH = fileArg ? fileArg.split('=')[1] : null;

// ── Main Seed Process ───────────────────────────────────────────────────────
const runSeed = async () => {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  💊 DrugIQ Dataset Seeder');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await connectDB();

  // 1. Handle Clear-only mode
  if (IS_CLEAR_ONLY) {
    logger.info('🗑️  Clearing all Drug and Review collections…');
    await Review.deleteMany({});
    await Drug.deleteMany({});
    logger.info('✅ Database cleared successfully.');
    await disconnectDB();
    process.exit(0);
  }

  // 2. Resolve CSV file path
  let targetFilePath;
  if (CUSTOM_FILE_PATH) {
    targetFilePath = path.isAbsolute(CUSTOM_FILE_PATH)
      ? CUSTOM_FILE_PATH
      : path.resolve(process.cwd(), CUSTOM_FILE_PATH);
  } else {
    targetFilePath = path.resolve(
      process.cwd(),
      'src/seed/data/drugsComTrain_raw.csv'
    );
  }

  logger.info(`📂 Dataset File: ${targetFilePath}`);

  // 3. Terminal Progress Callback
  let lastLoggedPercent = -1;
  const onProgress = (info) => {
    // Log progress every 5% or on completion to avoid terminal spam
    const roundedPercent = Math.floor(info.percentage / 5) * 5;
    if (roundedPercent !== lastLoggedPercent || info.percentage === 100) {
      lastLoggedPercent = roundedPercent;
      logger.info(
        `⏳ Progress: ${info.percentage}% | Row ${info.currentRow}/${info.estimatedTotalRows} ` +
          `| ${info.rowsPerSec} rows/s | Elapsed: ${info.elapsedTimeFormatted} | ETA: ${info.etaFormatted}`
      );
    }
  };

  // 4. Run Import Pipeline
  try {
    const summary = await ImportService.importDataset({
      filePath: targetFilePath,
      batchSize: 2000,
      resume: true,
      onProgress,
    });

    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🎉 SEED IMPORT COMPLETED SUCCESSFULLY');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`  Total CSV Rows : ${summary.totalRows}`);
    logger.info(`  New Imported   : ${summary.imported}`);
    logger.info(`  Skipped (Dupes): ${summary.skipped}`);
    logger.info(`  Failed Rows    : ${summary.failed}`);
    logger.info(`  Unique Drugs   : ${summary.uniqueDrugsInCache}`);
    logger.info(`  Processing Time: ${summary.processingTimeFormatted}`);
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    logger.error(`❌ Seeding failed: ${err.message}`, { stack: err.stack });
    await disconnectDB();
    process.exit(1);
  }
};

runSeed();
