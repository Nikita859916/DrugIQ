// ─── services/importService.js ────────────────────────────────────────────────
// Dataset Import & Aggregation Service.
// Handles high-performance batch importing of 215,000+ Kaggle drug reviews,
// automatic drug creation, real-time statistical aggregation, duplicate detection,
// and resumable import execution.
// ────────────────────────────────────────────────────────────────────────────

/* eslint-disable no-continue */
const path = require('path');
const { Drug, Review } = require('../models');
const { parseCSVInBatches, formatDuration } = require('../utils/csvParser');
const { cleanReviewText, cleanConditionText } = require('../utils/textCleaner');
const logger = require('../utils/logger');
const SentimentService = require('./sentimentService');
const SideEffectService = require('./sideEffectService');
const RiskAnalysisService = require('./riskAnalysisService');
const SimilarityService = require('./similarityService');
const SummaryService = require('./summaryService');

/**
 * Parse Kaggle dataset date format (e.g., "September 27, 2015" or "28-Feb-12")
 * @param {string} dateStr
 * @returns {Date}
 */
const parseDatasetDate = (dateStr) => {
  if (!dateStr) return new Date();
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

class ImportService {
  /**
   * Import Kaggle Drug Reviews dataset from a CSV file
   *
   * @param {object} options
   * @param {string} [options.filePath] - Absolute path to CSV file
   * @param {number} [options.batchSize=1000] - Rows per processing batch
   * @param {boolean} [options.resume=true] - Skip existing duplicate reviews
   * @param {string} [options.source='kaggle_train'] - Source label
   * @param {Function} [options.onProgress] - Real-time progress callback
   * @returns {Promise<object>} Import Summary Statistics
   */
  static async importDataset({
    filePath,
    batchSize = 1000,
    resume = true,
    source = 'kaggle_train',
    onProgress,
  } = {}) {
    const defaultPath = path.resolve(
      process.cwd(),
      'src/seed/data/drugsComTrain_raw.csv',
    );
    const targetFilePath = filePath || defaultPath;

    logger.info(`🚀 Starting Dataset Import from: ${targetFilePath}`);
    logger.info(`Batch Size: ${batchSize} | Resumable: ${resume}`);

    // Summary tracking metrics
    let totalRows = 0;
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const startTime = Date.now();

    // Cache of drugName -> Drug ObjectId to minimize DB roundtrips
    const drugCache = new Map();

    /**
     * Helper to get or create Drug ObjectId
     * @param {string} drugName
     * @returns {Promise<import('mongoose').Types.ObjectId>}
     */
    const getOrCreateDrugId = async (drugName) => {
      const normalisedName = drugName.trim();
      if (drugCache.has(normalisedName)) {
        return drugCache.get(normalisedName);
      }

      // Upsert drug document
      const drug = await Drug.findOneAndUpdate(
        { name: normalisedName },
        { $setOnInsert: { name: normalisedName } },
        { upsert: true, new: true, runValidators: true },
      ).exec();

      drugCache.set(normalisedName, drug._id);
      return drug._id;
    };

    /**
     * Batch processing function called by streaming parser
     */
    const processBatch = async (batchRows, progressInfo) => {
      const reviewDocsToInsert = [];
      const drugStatUpdates = new Map(); // drugId -> { ratings: [], conditions: Set }

      // 1. Process rows in current batch
      for (const row of batchRows) {
        try {
          const drugName = row.drugName || row.drug_name || row.drugName;
          const rawReview = row.review || row.review;
          const rawRating = row.rating || row.rating;
          const rawDate = row.date || row.date;
          const rawUseful = row.usefulCount || row.useful_count || row.usefulCount;
          const rawCondition = row.condition || row.condition;

          // Basic validation of required CSV fields
          if (!drugName || !rawReview || !rawRating) {
            failed += 1;
            continue;
          }

          const cleanedReview = cleanReviewText(rawReview);
          const cleanedCondition = cleanConditionText(rawCondition);
          const ratingNum = Math.min(10, Math.max(1, parseInt(rawRating, 10) || 5));
          const usefulNum = Math.max(0, parseInt(rawUseful, 10) || 0);
          const reviewDate = parseDatasetDate(rawDate);

          // Get or create drug ID
          const drugId = await getOrCreateDrugId(drugName.trim());

          // Duplicate detection (Resumable mode)
          if (resume) {
            const isDuplicate = await Review.exists({
              drug: drugId,
              rating: ratingNum,
              date: reviewDate,
              review: rawReview.trim(),
            });

            if (isDuplicate) {
              skipped += 1;
              continue;
            }
          }

          // Process review text through NLP engine (sentiment + side effects)
          const nlp = SentimentService.processReviewText(rawReview);

          // Build Review document for batch insertion
          reviewDocsToInsert.push({
            drug: drugId,
            drugName: drugName.trim(),
            condition: cleanedCondition,
            review: rawReview.trim(),
            cleanedReview,
            rating: ratingNum,
            date: reviewDate,
            usefulCount: usefulNum,
            source,
            sentiment: {
              score: nlp.sentimentScore,
              label: nlp.sentimentLabel,
              confidence: Math.min(1, Math.abs(nlp.sentimentScore) + 0.3),
              positive: nlp.sentimentScore > 0.05 ? nlp.sentimentScore : 0,
              negative: nlp.sentimentScore < -0.05 ? Math.abs(nlp.sentimentScore) : 0,
              neutral: Math.max(0, 1 - Math.abs(nlp.sentimentScore)),
            },
            predictedSideEffects: nlp.predictedSideEffects,
            isAnalysed: true,
          });

          // Accumulate real-time stat updates per drug
          const drugIdStr = drugId.toString();
          if (!drugStatUpdates.has(drugIdStr)) {
            drugStatUpdates.set(drugIdStr, {
              drugId,
              ratings: [],
              usefulCount: 0,
              conditions: new Set(),
            });
          }

          const drugStats = drugStatUpdates.get(drugIdStr);
          drugStats.ratings.push(ratingNum);
          drugStats.usefulCount += usefulNum;
          if (cleanedCondition) {
            drugStats.conditions.add(cleanedCondition);
          }
        } catch (rowErr) {
          failed += 1;
          logger.warn(`Failed to process CSV row: ${rowErr.message}`);
        }
      }

      // 2. Perform Bulk Write Insertion for Reviews
      if (reviewDocsToInsert.length > 0) {
        try {
          const result = await Review.insertMany(reviewDocsToInsert, {
            ordered: false,
          });
          imported += result.length;
        } catch (bulkErr) {
          // If partial bulk write failure occurs, count inserted docs
          if (bulkErr.insertedDocs) {
            imported += bulkErr.insertedDocs.length;
            failed += reviewDocsToInsert.length - bulkErr.insertedDocs.length;
          } else {
            failed += reviewDocsToInsert.length;
          }
        }
      }

      // 3. Perform Bulk Update for Drug Aggregated Stats
      if (drugStatUpdates.size > 0) {
        const drugBulkOps = [];

        for (const [, stats] of drugStatUpdates) {
          const addedCount = stats.ratings.length;
          const conditionArray = Array.from(stats.conditions);

          drugBulkOps.push({
            updateOne: {
              filter: { _id: stats.drugId },
              update: {
                $inc: {
                  reviewCount: addedCount,
                  totalUsefulCount: stats.usefulCount,
                },
                $addToSet: {
                  conditions: { $each: conditionArray },
                },
                $set: {
                  isAggregated: false, // Flag for background NLP worker
                },
              },
            },
          });
        }

        if (drugBulkOps.length > 0) {
          await Drug.bulkWrite(drugBulkOps, { ordered: false });
        }
      }

      // 4. Fire progress event
      if (onProgress) {
        onProgress({
          ...progressInfo,
          imported,
          skipped,
          failed,
        });
      }
    };

    // Execute Streaming Batch Parser
    const parserResult = await parseCSVInBatches({
      filePath: targetFilePath,
      batchSize,
      onBatch: processBatch,
    });

    totalRows = parserResult.totalRows;

    // 5. Recompute exact averageRating for all updated drugs
    await this.recalculateDrugAverageRatings();

    const durationMs = Date.now() - startTime;
    const formattedTime = formatDuration(durationMs);

    const summary = {
      totalRows,
      imported,
      skipped,
      failed,
      uniqueDrugsInCache: drugCache.size,
      processingTimeMs: durationMs,
      processingTimeFormatted: formattedTime,
      rowsPerSecond: Math.round(totalRows / (durationMs / 1000 || 1)),
    };

    logger.info('✅ Dataset Import Summary:');
    logger.info(`   - Total Rows   : ${summary.totalRows}`);
    logger.info(`   - Imported     : ${summary.imported}`);
    logger.info(`   - Skipped      : ${summary.skipped}`);
    logger.info(`   - Failed       : ${summary.failed}`);
    logger.info(`   - Time Taken   : ${summary.processingTimeFormatted}`);

    return summary;
  }

  /**
   * Recalculate exact averageRating across all drugs post-import
   */
  static async recalculateDrugAverageRatings() {
    logger.info('🔄 Recalculating average ratings for all drugs…');

    const aggregationPipeline = [
      {
        $group: {
          _id: '$drug',
          reviewCount: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          totalUsefulCount: { $sum: '$usefulCount' },
        },
      },
    ];

    const results = await Review.aggregate(aggregationPipeline).exec();
    const bulkOps = results.map((res) => ({
      updateOne: {
        filter: { _id: res._id },
        update: {
          $set: {
            reviewCount: res.reviewCount,
            averageRating: Math.round(res.averageRating * 100) / 100,
            totalUsefulCount: res.totalUsefulCount,
          },
        },
      },
    }));

    if (bulkOps.length > 0) {
      await Drug.bulkWrite(bulkOps);
      logger.info(`✅ Average ratings updated for ${bulkOps.length} drugs.`);
    }
  }

  /**
   * Fully aggregate statistics and NLP intelligence for a single drug.
   *
   * @param {import('mongoose').Types.ObjectId|string} drugId
   * @returns {Promise<object|null>} Aggregated drug document
   */
  static async aggregateDrug(drugId) {
    const drug = await Drug.findById(drugId);
    if (!drug) return null;

    // 1. Recompute basic stats (rating, count, useful, conditions) from reviews
    const statsAgg = await Review.aggregate([
      { $match: { drug: drug._id } },
      {
        $group: {
          _id: null,
          reviewCount: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          totalUseful: { $sum: '$usefulCount' },
          conditions: { $addToSet: '$condition' },
        },
      },
    ]).exec();

    if (statsAgg.length > 0) {
      const stats = statsAgg[0];
      const validConditions = (stats.conditions || []).filter(
        (c) => c && typeof c === 'string',
      );

      await Drug.updateOne(
        { _id: drug._id },
        {
          $set: {
            reviewCount: stats.reviewCount,
            averageRating: stats.avgRating != null
              ? Math.round(stats.avgRating * 100) / 100
              : null,
            totalUsefulCount: stats.totalUseful || 0,
            conditions: validConditions,
          },
        },
      );
    }

    // 2. Aggregate common side effects
    await SideEffectService.aggregateDrugSideEffects(drug._id);

    // 3. Compute Risk profile and sentiment distribution
    await RiskAnalysisService.updateDrugRisk(drug._id);

    // 4. Compute Top 5 similar drugs
    await SimilarityService.updateDrugSimilarities(drug._id);

    // 5. Generate plain-language summary
    await SummaryService.generateForDrug(drug._id, { persist: true });

    // 6. Mark drug as aggregated
    await Drug.updateOne(
      { _id: drug._id },
      {
        $set: {
          isAggregated: true,
          lastAggregatedAt: new Date(),
        },
      },
    );

    return Drug.findById(drug._id).lean().exec();
  }

  /**
   * Aggregate all pending drugs that need re-aggregation.
   *
   * @param {number} [limit=100]
   * @returns {Promise<{ processed: number, failures: number }>}
   */
  static async aggregatePendingDrugs(limit = 100) {
    const pendingDrugs = await Drug.findPendingAggregation(limit);
    logger.info(`🔄 Aggregating ${pendingDrugs.length} pending drugs…`);

    let processed = 0;
    let failures = 0;

    for (const drug of pendingDrugs) {
      try {
        await this.aggregateDrug(drug._id);
        processed += 1;
      } catch (err) {
        logger.warn(`Failed to aggregate drug "${drug.name}": ${err.message}`);
        failures += 1;
      }
    }

    logger.info(`✅ Aggregation completed. Processed: ${processed}, Failures: ${failures}`);
    return { processed, failures };
  }
}

module.exports = ImportService;
