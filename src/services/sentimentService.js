// ─── services/sentimentService.js ─────────────────────────────────────────────
// Sentiment Analysis Service using VADER-style sentiment engine.
// Analyzes review text, classifies sentiment labels (Positive, Neutral, Negative),
// and updates Review documents in bulk.
// ────────────────────────────────────────────────────────────────────────────

const Sentiment = require('sentiment');
const { Review } = require('../models');
const logger = require('../utils/logger');
const { cleanReviewText } = require('../utils/textCleaner');
const SideEffectService = require('./sideEffectService');

const sentimentAnalyzer = new Sentiment();

class SentimentService {
  /**
   * Analyze sentiment of a text string
   * @param {string} text - Review text
   * @returns {object} Sentiment result object containing score, label, confidence, etc.
   */
  static analyzeText(text) {
    if (!text || typeof text !== 'string') {
      return {
        score: 0,
        label: 'neutral',
        confidence: 0,
        positive: 0,
        negative: 0,
        neutral: 1,
      };
    }

    const result = sentimentAnalyzer.analyze(text);
    const wordCount = Math.max(1, result.tokens.length);

    // Normalize raw VADER-style score to [-1.0, +1.0] range
    const normalizedScore = Math.max(
      -1,
      Math.min(1, Math.round((result.score / Math.sqrt(wordCount)) * 100) / 100),
    );

    // Assign label based on thresholds
    let label = 'neutral';
    if (normalizedScore > 0.05) label = 'positive';
    else if (normalizedScore < -0.05) label = 'negative';

    const posWords = result.positive ? result.positive.length : 0;
    const negWords = result.negative ? result.negative.length : 0;
    const neuWords = Math.max(0, wordCount - posWords - negWords);

    return {
      score: normalizedScore,
      label,
      confidence: Math.min(1, Math.abs(normalizedScore) + 0.3),
      positive: Math.round((posWords / wordCount) * 100) / 100,
      negative: Math.round((negWords / wordCount) * 100) / 100,
      neutral: Math.round((neuWords / wordCount) * 100) / 100,
    };
  }

  /**
   * Analyze sentiment for a single review document
   * @param {object} reviewDoc
   * @returns {object} Sentiment object
   */
  static analyzeReview(reviewDoc) {
    const textToAnalyze = reviewDoc.cleanedReview || reviewDoc.review;
    return this.analyzeText(textToAnalyze);
  }

  /**
   * Reusable function that combines text cleaning, sentiment analysis,
   * and side-effect extraction.
   *
   * @param {string} rawText - Verbatim patient review text
   * @returns {object} Combined review extraction results.
   */
  static processReviewText(rawText) {
    const cleaned = cleanReviewText(rawText);
    const sentimentResult = this.analyzeText(cleaned);
    const predictedSideEffects = SideEffectService.extractFromText(cleaned);

    return {
      sentimentScore: sentimentResult.score,
      sentimentLabel: sentimentResult.label,
      predictedSideEffects,
    };
  }

  /**
   * Batch analyze unanalysed reviews in the database
   * @param {number} [batchSize=1000]
   * @returns {Promise<{ processed: number, updated: number }>}
   */
  static async processUnanalysedReviews(batchSize = 1000) {
    const unanalysedReviews = await Review.find({ isAnalysed: false })
      .limit(batchSize)
      .select('_id review cleanedReview')
      .lean()
      .exec();

    if (!unanalysedReviews.length) {
      return { processed: 0, updated: 0 };
    }

    const bulkOps = unanalysedReviews.map((rev) => {
      const sentimentResult = this.analyzeReview(rev);
      return {
        updateOne: {
          filter: { _id: rev._id },
          update: {
            $set: {
              sentiment: sentimentResult,
              isAnalysed: true,
            },
          },
        },
      };
    });

    const bulkResult = await Review.bulkWrite(bulkOps, { ordered: false });
    logger.info(`✅ Sentiment Service: Analyzed ${bulkResult.modifiedCount} reviews.`);

    return {
      processed: unanalysedReviews.length,
      updated: bulkResult.modifiedCount || 0,
    };
  }
}

module.exports = SentimentService;
