// ─── services/sideEffectService.js ───────────────────────────────────────────
// Side Effect Extraction & Aggregation Service.
// Extracts canonical side effects from review text using medical dictionary,
// and aggregates drug-level side effect frequency distributions.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { Review, Drug } = require('../models');
const { extractSideEffectsFromText, getSideEffectSeverity } = require('../utils/medicalDictionary');
const logger = require('../utils/logger');

class SideEffectService {
  /**
   * Extract unique side effects from raw or cleaned text
   * @param {string} text
   * @returns {Array<{ effect: string, confidence: number, source: string }>}
   */
  static extractFromText(text) {
    const matches = extractSideEffectsFromText(text);
    return matches.map((m) => ({
      effect: m.effect,
      confidence: 0.85,
      source: 'keyword',
    }));
  }

  /**
   * Process side effect extraction for a batch of unanalysed reviews
   * @param {number} [batchSize=1000]
   * @returns {Promise<{ processed: number, updated: number }>}
   */
  static async extractBatchSideEffects(batchSize = 1000) {
    const reviews = await Review.find({
      'predictedSideEffects.0': { $exists: false },
    })
      .limit(batchSize)
      .select('_id review cleanedReview')
      .lean()
      .exec();

    if (!reviews.length) return { processed: 0, updated: 0 };

    const bulkOps = reviews.map((rev) => {
      const textToScan = rev.cleanedReview || rev.review;
      const predictedSideEffects = this.extractFromText(textToScan);

      return {
        updateOne: {
          filter: { _id: rev._id },
          update: {
            $set: { predictedSideEffects },
          },
        },
      };
    });

    const bulkResult = await Review.bulkWrite(bulkOps, { ordered: false });
    return {
      processed: reviews.length,
      updated: bulkResult.modifiedCount || 0,
    };
  }

  /**
   * Aggregate side effect statistics for a specific Drug
   * @param {import('mongoose').Types.ObjectId} drugId
   * @returns {Promise<Array<{ effect: string, frequency: number, frequencyPercent: number, severity: string }>>}
   */
  static async aggregateDrugSideEffects(drugId) {
    // Pipeline to aggregate frequency of predicted side effects for this drug
    const pipeline = [
      { $match: { drug: drugId, 'predictedSideEffects.0': { $exists: true } } },
      { $unwind: '$predictedSideEffects' },
      {
        $group: {
          _id: '$predictedSideEffects.effect',
          frequency: { $sum: 1 },
        },
      },
      { $sort: { frequency: -1 } },
      { $limit: 20 }, // Top 20 side effects per drug
    ];

    const aggregated = await Review.aggregate(pipeline).exec();
    const drug = await Drug.findById(drugId).select('reviewCount').lean().exec();
    const totalReviews = drug ? Math.max(1, drug.reviewCount) : 1;

    const commonSideEffects = aggregated.map((item) => {
      const effectName = item._id;
      const frequency = item.frequency;
      const frequencyPercent = Math.min(
        100,
        Math.round((frequency / totalReviews) * 100 * 10) / 10
      );
      const severity = getSideEffectSeverity(effectName);

      return {
        effect: effectName,
        frequency,
        frequencyPercent,
        severity,
      };
    });

    // Update Drug document with aggregated commonSideEffects
    await Drug.updateOne(
      { _id: drugId },
      { $set: { commonSideEffects } }
    ).exec();

    return commonSideEffects;
  }
}

module.exports = SideEffectService;
