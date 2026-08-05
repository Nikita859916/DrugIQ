// ─── controllers/importController.js ─────────────────────────────────────────
// Dataset Import Controller (Admin Only).
// Receives HTTP POST requests to trigger Kaggle dataset import and returns detailed summary.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const path = require('path');
const ImportService = require('../services/importService');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

/**
 * @desc    Import Kaggle Drug Reviews Dataset (Admin Only)
 * @route   POST /api/v1/admin/import-dataset
 * @access  Private/Admin
 */
const importDataset = asyncHandler(async (req, res) => {
  const { filePath, batchSize, resume, source } = req.body;

  let resolvedPath;
  if (filePath) {
    resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
  } else {
    resolvedPath = path.resolve(
      process.cwd(),
      'src/seed/data/drugsComTrain_raw.csv'
    );
  }

  const parsedBatchSize = parseInt(batchSize, 10) || 1000;
  const isResumable = resume !== false;

  const summary = await ImportService.importDataset({
    filePath: resolvedPath,
    batchSize: parsedBatchSize,
    resume: isResumable,
    source: source || 'kaggle_train',
  });

  sendSuccess(res, {
    message: '🎉 Dataset import completed successfully',
    data: {
      summary,
    },
  });
});

module.exports = {
  importDataset,
};
