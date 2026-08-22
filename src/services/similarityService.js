// ─── services/similarityService.js ───────────────────────────────────────────
// Drug Similarity Service.
// Calculates multi-factor weighted similarity between drugs (Jaccard side effect overlap,
// condition overlap, rating closeness, sentiment vector) and populates Top 5 Similar Drugs.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { Drug } = require('../models');
const { calculateWeightedDrugSimilarity } = require('../utils/similarityCalculator');
const logger = require('../utils/logger');

class SimilarityService {
  /**
   * Find Top 5 Similar Drugs for a target Drug
   *
   * @param {import('mongoose').Types.ObjectId|string} drugId - Target drug ObjectId
   * @param {number} [topK=5] - Number of top similar drugs to return (default 5)
   * @returns {Promise<Array<{ drug: import('mongoose').Types.ObjectId, similarityScore: number }>>}
   */
  static async findTopSimilarDrugs(drugId, topK = 5) {
    const targetDrug = await Drug.findById(drugId).lean().exec();
    if (!targetDrug) return [];

    // Find candidate drugs sharing at least one condition or side effect
    const candidateQuery = {
      _id: { $ne: targetDrug._id },
      $or: [],
    };

    if (targetDrug.conditions && targetDrug.conditions.length > 0) {
      candidateQuery.$or.push({ conditions: { $in: targetDrug.conditions } });
    }

    const sideEffectNames = (targetDrug.commonSideEffects || []).map(
      (se) => (typeof se === 'string' ? se : se.effect)
    );
    if (sideEffectNames.length > 0) {
      candidateQuery.$or.push({ 'commonSideEffects.effect': { $in: sideEffectNames } });
    }

    // Fallback if no matching condition/side effect found
    if (!candidateQuery.$or.length) {
      delete candidateQuery.$or;
    }

    const candidateDrugs = await Drug.find(candidateQuery)
      .limit(300) // Scan top candidate pool for efficiency
      .lean()
      .exec();

    // Calculate similarity score for each candidate
    const scoredCandidates = candidateDrugs.map((candidate) => {
      const similarityScore = calculateWeightedDrugSimilarity(targetDrug, candidate);
      return {
        drug: candidate._id,
        similarityScore,
      };
    });

    // Sort descending by similarityScore and slice topK (Top 5)
    const topSimilar = scoredCandidates
      .filter((c) => c.similarityScore > 0.05) // Filter out zero/negligible similarity
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, topK);

    return topSimilar;
  }

  /**
   * Update Top 5 Similar Drugs cache for a target Drug
   * @param {import('mongoose').Types.ObjectId|string} drugId
   * @returns {Promise<Array>} Top 5 similar drugs array
   */
  static async updateDrugSimilarities(drugId) {
    const topSimilar = await this.findTopSimilarDrugs(drugId, 5);

    await Drug.updateOne(
      { _id: drugId },
      { $set: { similarDrugs: topSimilar } }
    ).exec();

    return topSimilar;
  }

  /**
   * Batch update Top 5 Similar Drugs for all drugs in the database
   * @returns {Promise<{ updatedCount: number }>}
   */
  static async updateAllDrugSimilarities() {
    const drugs = await Drug.find({}).select('_id name').lean().exec();
    logger.info(`🔄 Similarity Service: Computing Top 5 Similar Drugs for ${drugs.length} drugs…`);

    let updatedCount = 0;
    for (const drug of drugs) {
      await this.updateDrugSimilarities(drug._id);
      updatedCount += 1;
    }

    logger.info(`✅ Similarity Service: Updated similarity recommendations for ${updatedCount} drugs.`);
    return { updatedCount };
  }
}

module.exports = SimilarityService;
