// ─── services/riskAnalysisService.js ──────────────────────────────────────────
// Drug Safety & Risk Analysis Engine.
// Calculates multi-factor riskScore (0-100) and riskCluster (low, moderate, high, critical)
// based on ratings, negative review concentration, and severe side effect frequency.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { Drug, Review } = require('../models');
const logger = require('../utils/logger');

class RiskAnalysisService {
  /**
   * Calculate numerical risk score (0 to 100) for a drug
   *
   * Formula:
   * 1. Low Rating Penalty          : (10 - averageRating) * 4.5  (Max 40.5 pts)
   * 2. Negative Sentiment Penalty  : (negativePercent / 100) * 35 (Max 35 pts)
   * 3. Severe Side Effect Penalty  : (severeEffectRatio) * 24.5  (Max 24.5 pts)
   * Total = Sum clamped to [0, 100]
   *
   * @param {object} stats
   * @param {number} stats.averageRating - Rating 1-10
   * @param {number} stats.negativePercent - Percentage 0-100
   * @param {number} stats.severeCount - Count of severe side effect reports
   * @param {number} stats.reviewCount - Total review count
   * @returns {number} Score rounded to 2 decimal places (0 to 100)
   */
  static calculateRiskScore({ averageRating = 7.5, negativePercent = 0, severeCount = 0, reviewCount = 1 }) {
    const safeRating = averageRating == null ? 7.5 : averageRating;
    const safeReviewCount = Math.max(1, reviewCount);

    // 1. Low Rating Component (Lower rating = Higher risk score)
    const ratingPenalty = Math.max(0, (10 - safeRating) * 4.5);

    // 2. Negative Sentiment Component
    const negativePenalty = (Math.min(100, Math.max(0, negativePercent)) / 100) * 35;

    // 3. Severe Side Effect Ratio Component
    const severeRatio = Math.min(1, severeCount / safeReviewCount);
    const severePenalty = severeRatio * 24.5;

    const rawRiskScore = ratingPenalty + negativePenalty + severePenalty;
    return Math.round(Math.min(100, Math.max(0, rawRiskScore)) * 100) / 100;
  }

  /**
   * Determine categorical risk cluster / level from numerical risk score.
   * Maps 0-100 to exactly three tiers (low, moderate, high) corresponding to Low, Medium, High.
   *
   * @param {number} riskScore - 0 to 100
   * @returns {'low'|'moderate'|'high'}
   */
  static getRiskLevel(riskScore) {
    if (riskScore <= 30) return 'low';
    if (riskScore <= 60) return 'moderate';
    return 'high';
  }

  /**
   * Compute and update risk metrics for a single Drug
   * @param {import('mongoose').Types.ObjectId} drugId
   * @returns {Promise<{ riskScore: number, riskCluster: string }>}
   */
  static async updateDrugRisk(drugId) {
    const drug = await Drug.findById(drugId).exec();
    if (!drug) return null;

    // 1. Compute Sentiment Counts
    const sentimentStats = await Review.aggregate([
      { $match: { drug: drugId, 'sentiment.label': { $ne: 'unanalysed' } } },
      {
        $group: {
          _id: '$sentiment.label',
          count: { $sum: 1 },
        },
      },
    ]).exec();

    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;

    sentimentStats.forEach((st) => {
      if (st._id === 'positive') positiveCount = st.count;
      else if (st._id === 'neutral') neutralCount = st.count;
      else if (st._id === 'negative') negativeCount = st.count;
    });

    const totalAnalysed = positiveCount + neutralCount + negativeCount || 1;
    const positivePercent = Math.round((positiveCount / totalAnalysed) * 100 * 10) / 10;
    const neutralPercent = Math.round((neutralCount / totalAnalysed) * 100 * 10) / 10;
    const negativePercent = Math.round((negativeCount / totalAnalysed) * 100 * 10) / 10;

    // 2. Count severe side effects
    const severeSideEffects = (drug.commonSideEffects || []).filter(
      (se) => se.severity === 'severe'
    );
    const severeCount = severeSideEffects.reduce(
      (sum, se) => sum + (se.frequency || 0),
      0
    );

    // 3. Compute Risk Score & Risk Cluster
    const riskScore = this.calculateRiskScore({
      averageRating: drug.averageRating,
      negativePercent,
      severeCount,
      reviewCount: drug.reviewCount,
    });

    const riskCluster = this.getRiskLevel(riskScore);

    // 4. Update Drug Document
    drug.positiveReviews = positiveCount;
    drug.neutralReviews = neutralCount;
    drug.negativeReviews = negativeCount;
    drug.sentimentDistribution = {
      positive: positivePercent,
      neutral: neutralPercent,
      negative: negativePercent,
    };
    drug.riskScore = riskScore;
    drug.riskCluster = riskCluster;

    await drug.save();

    return { riskScore, riskCluster };
  }

  /**
   * Batch update risk scores for all drugs
   * @returns {Promise<{ updatedCount: number }>}
   */
  static async updateAllDrugRisks() {
    const drugs = await Drug.find({}).select('_id name').lean().exec();
    logger.info(`🔄 Risk Analysis Service: Updating risk profiles for ${drugs.length} drugs…`);

    let updatedCount = 0;
    for (const drug of drugs) {
      await this.updateDrugRisk(drug._id);
      updatedCount += 1;
    }

    logger.info(`✅ Risk Analysis Service: Updated ${updatedCount} drug risk profiles.`);
    return { updatedCount };
  }
}

module.exports = RiskAnalysisService;
