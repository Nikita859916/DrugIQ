// ─── utils/csvParser.js ──────────────────────────────────────────────────────
// Streaming CSV Parser with memory-efficient batch processing and real-time progress calculations.
// Uses csv-parser to parse 200,000+ row files without memory overflows.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const fs = require('fs');
const csv = require('csv-parser');
const AppError = require('./AppError');

/**
 * Estimate total line count in a CSV file (for accurate progress bar calculation)
 * @param {string} filePath
 * @returns {Promise<number>} Estimated total rows
 */
const countFileLines = (filePath) => {
  return new Promise((resolve) => {
    let lineCount = 0;
    fs.createReadStream(filePath)
      .on('data', (chunk) => {
        for (let i = 0; i < chunk.length; i += 1) {
          if (chunk[i] === 10) lineCount += 1; // 10 is '\n'
        }
      })
      .on('end', () => resolve(Math.max(1, lineCount - 1))) // exclude header
      .on('error', () => resolve(215000)); // default estimate fallback
  });
};

/**
 * Format milliseconds into human-readable time (e.g. "2m 15s")
 * @param {number} ms
 * @returns {string}
 */
const formatDuration = (ms) => {
  if (!ms || ms < 0 || !Number.isFinite(ms)) return 'calculating...';
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor(ms / (1000 * 60 * 60));

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

/**
 * Process a CSV file in memory-efficient stream batches
 *
 * @param {object} options
 * @param {string} options.filePath - Path to CSV file
 * @param {number} [options.batchSize=1000] - Rows per batch
 * @param {Function} options.onBatch - async (batchRows, progressInfo) => void
 * @param {Function} [options.onProgress] - (progressInfo) => void
 * @returns {Promise<{ totalRows: number, processedRows: number, durationMs: number }>}
 */
const parseCSVInBatches = async ({
  filePath,
  batchSize = 1000,
  onBatch,
  onProgress,
}) => {
  if (!fs.existsSync(filePath)) {
    throw AppError.notFound(`Dataset file not found at path: ${filePath}`);
  }

  const startTime = Date.now();
  const estimatedTotalRows = await countFileLines(filePath);

  return new Promise((resolve, reject) => {
    let currentBatch = [];
    let processedRows = 0;
    let isProcessingBatch = false;

    const stream = fs.createReadStream(filePath).pipe(
      csv({
        mapHeaders: ({ header }) => header.trim().replace(/^"/, '').replace(/"$/, ''),
      })
    );

    const processNextBatch = async () => {
      if (currentBatch.length === 0) return;

      isProcessingBatch = true;
      stream.pause(); // Pause stream reading while processing batch to preserve memory

      const batchToProcess = [...currentBatch];
      currentBatch = [];
      processedRows += batchToProcess.length;

      const elapsedTimeMs = Date.now() - startTime;
      const rowsPerSec = processedRows / (elapsedTimeMs / 1000 || 1);
      const remainingRows = Math.max(0, estimatedTotalRows - processedRows);
      const etaMs = (remainingRows / (rowsPerSec || 1)) * 1000;
      const percentage = Math.min(
        100,
        Math.round((processedRows / estimatedTotalRows) * 100 * 10) / 10
      );

      const progressInfo = {
        currentRow: processedRows,
        estimatedTotalRows,
        percentage,
        rowsPerSec: Math.round(rowsPerSec),
        elapsedTimeFormatted: formatDuration(elapsedTimeMs),
        etaFormatted: formatDuration(etaMs),
        etaMs,
      };

      try {
        if (onBatch) {
          await onBatch(batchToProcess, progressInfo);
        }
        if (onProgress) {
          onProgress(progressInfo);
        }
      } catch (err) {
        stream.destroy();
        return reject(err);
      } finally {
        isProcessingBatch = false;
        stream.resume(); // Resume stream reading
      }
    };

    stream.on('data', (row) => {
      currentBatch.push(row);
      if (currentBatch.length >= batchSize && !isProcessingBatch) {
        processNextBatch();
      }
    });

    stream.on('end', async () => {
      try {
        // Process remaining rows in buffer
        if (currentBatch.length > 0) {
          await processNextBatch();
        }
        const durationMs = Date.now() - startTime;
        resolve({
          totalRows: estimatedTotalRows,
          processedRows,
          durationMs,
        });
      } catch (err) {
        reject(err);
      }
    });

    stream.on('error', (err) => {
      reject(AppError.internal(`CSV parsing failed: ${err.message}`));
    });
  });
};

module.exports = {
  parseCSVInBatches,
  countFileLines,
  formatDuration,
};
