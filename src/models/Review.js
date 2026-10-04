// ─── models/Review.js ────────────────────────────────────────────────────────
// Review collection — one document per row from the Kaggle Drug Reviews CSV.
//
// CSV column → Schema field mapping:
//   drugName    → drug (ObjectId ref to Drug)
//   condition   → condition
//   review      → review (raw) / cleanedReview (NLP-processed)
//   rating      → rating
//   date        → date
//   usefulCount → usefulCount
//
// NLP-enriched fields (added post-seed by the NLP pipeline):
//   sentiment, sentimentLabel, predictedSideEffects, cleanedReview
//
// Dataset: https://www.kaggle.com/datasets/jessicali9530/kuc-hackathon-winter-2018
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

// ── Sub-schema: Sentiment ─────────────────────────────────────────────────────
const SentimentSchema = new Schema(
  {
    /**
     * Compound sentiment score: -1.0 (very negative) → +1.0 (very positive).
     * Computed by the NLP service (VADER / Transformers).
     */
    score: {
      type: Number,
      min: -1,
      max: 1,
      default: null,
    },

    /** Human-readable label derived from the score */
    label: {
      type: String,
      enum: {
        values: ['positive', 'neutral', 'negative', 'unanalysed'],
        message: 'Sentiment label must be positive | neutral | negative | unanalysed',
      },
      default: 'unanalysed',
      index: true,
    },

    /** Confidence of the prediction (0–1) */
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },

    /** Polarity sub-scores (VADER style) */
    positive: { type: Number, min: 0, max: 1, default: null },
    negative: { type: Number, min: 0, max: 1, default: null },
    neutral: { type: Number, min: 0, max: 1, default: null },
  },
  { _id: false }
);

// ── Sub-schema: Predicted Side Effect ────────────────────────────────────────
const PredictedSideEffectSchema = new Schema(
  {
    /** Side-effect label (normalised lowercase) */
    effect: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    /** Confidence score for the prediction (0–1) */
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },

    /**
     * NLP technique that produced this prediction:
     *   'keyword'   – simple keyword matching
     *   'ner'       – Named Entity Recognition
     *   'model'     – ML classifier
     */
    source: {
      type: String,
      enum: ['keyword', 'ner', 'model', 'manual'],
      default: 'keyword',
    },
  },
  { _id: false }
);

// ── Main Review Schema ────────────────────────────────────────────────────────
const ReviewSchema = new Schema(
  {
    // ── Relationships ─────────────────────────────────────────────────────────

    /**
     * Reference to the Drug document.
     * Every review MUST belong to exactly one drug.
     */
    drug: {
      type: Schema.Types.ObjectId,
      ref: 'Drug',
      required: [true, 'Review must be linked to a drug'],
      index: true,
    },

    // ── CSV Source Fields ─────────────────────────────────────────────────────

    /**
     * Denormalised drug name string (from CSV column "drugName").
     * Preserved for fast filtering without a join, and for debugging
     * any Drug → Review linkage issues during seed.
     */
    drugName: {
      type: String,
      required: [true, 'Drug name string is required'],
      trim: true,
      index: true,
    },

    /**
     * Medical condition the reviewer was treating.
     * Corresponds to the CSV "condition" column.
     * Some rows contain null / "Not Listed" — both are preserved as-is.
     */
    condition: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    /**
     * Verbatim patient review text (from CSV "review" column).
     * HTML entities are NOT decoded at this stage — that happens in cleanedReview.
     */
    review: {
      type: String,
      required: [true, 'Review text is required'],
      trim: true,
      minlength: [1, 'Review text cannot be empty'],
      maxlength: [50000, 'Review text cannot exceed 50,000 characters'],
    },

    /**
     * Patient self-reported rating (1–10).
     * CSV column "rating" — already an integer in the dataset.
     */
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating minimum is 1'],
      max: [10, 'Rating maximum is 10'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number',
      },
      index: true,
    },

    /**
     * Date the review was posted.
     * CSV column "date" — stored as a Date object after parsing.
     * Example CSV value: "September 27, 2015"
     */
    date: {
      type: Date,
      required: [true, 'Review date is required'],
      index: true,
    },

    /**
     * Number of users who found this review helpful.
     * CSV column "usefulCount".
     */
    usefulCount: {
      type: Number,
      default: 0,
      min: [0, 'usefulCount cannot be negative'],
      index: true,
    },

    // ── NLP-Enriched Fields ───────────────────────────────────────────────────

    /**
     * Sentiment analysis result.
     * Populated by the NLP pipeline after seeding.
     */
    sentiment: {
      type: SentimentSchema,
      default: () => ({
        score: null,
        label: 'unanalysed',
        confidence: null,
        positive: null,
        negative: null,
        neutral: null,
      }),
    },

    /**
     * Side effects detected / predicted from the review text by the NLP pipeline.
     * Sorted descending by confidence.
     */
    predictedSideEffects: {
      type: [PredictedSideEffectSchema],
      default: [],
    },

    /**
     * Cleaned and normalised version of the review text:
     *   - HTML entities decoded
     *   - Special characters stripped
     *   - Lowercased
     *   - Stop words optionally removed
     * Used as the input to NLP models.
     * Populated by the NLP pipeline.
     */
    cleanedReview: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Processing Flags ──────────────────────────────────────────────────────

    /** Whether the NLP pipeline has processed this review */
    isAnalysed: {
      type: Boolean,
      default: false,
      index: true,
    },

    /** Source of this review document */
    source: {
      type: String,
      enum: ['kaggle_train', 'kaggle_test', 'api', 'manual'],
      default: 'kaggle_train',
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },

    toObject: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Primary query patterns
ReviewSchema.index({ drug: 1, rating: -1 });
ReviewSchema.index({ drug: 1, date: -1 });
ReviewSchema.index({ drug: 1, 'sentiment.label': 1 });
ReviewSchema.index({ drug: 1, condition: 1 });
ReviewSchema.index({ condition: 1, rating: -1 });
ReviewSchema.index({ drugName: 1, condition: 1 });
ReviewSchema.index({ usefulCount: -1 });
ReviewSchema.index({ isAnalysed: 1 });
ReviewSchema.index({ date: -1 });

// Full-text search on review text
ReviewSchema.index(
  { review: 'text', cleanedReview: 'text', condition: 'text' },
  {
    weights: { cleanedReview: 5, review: 3, condition: 1 },
    name: 'review_text_search',
    default_language: 'english',
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

/**
 * Determine if this review is considered "positive" based on rating.
 * (Distinct from sentiment label which comes from NLP.)
 */
ReviewSchema.virtual('isHighRated').get(function () {
  return this.rating >= 7;
});

/** Determines if the review contains any predicted side effects */
ReviewSchema.virtual('hasSideEffects').get(function () {
  return this.predictedSideEffects && this.predictedSideEffects.length > 0;
});

/** Number of predicted side effects */
ReviewSchema.virtual('sideEffectCount').get(function () {
  return this.predictedSideEffects ? this.predictedSideEffects.length : 0;
});

/** Rating bucketed as low / medium / high */
ReviewSchema.virtual('ratingBucket').get(function () {
  if (this.rating <= 3) return 'low';
  if (this.rating <= 6) return 'medium';
  return 'high';
});

// ── Pre-Save Middleware ────────────────────────────────────────────────────────

/**
 * Automatically process review text using SentimentService if unanalysed:
 * Cleans review text, calculates sentiment score & label, and extracts side effects.
 */
ReviewSchema.pre('save', function processReviewNLP(next) {
  if (this.review && (!this.isAnalysed || this.isModified('review'))) {
    try {
      // eslint-disable-next-line global-require
      const SentimentService = require('../services/sentimentService');
      // eslint-disable-next-line global-require
      const { cleanReviewText } = require('../utils/textCleaner');

      this.cleanedReview = cleanReviewText(this.review);
      const nlp = SentimentService.processReviewText(this.review);
      if (!nlp || typeof nlp.sentimentScore !== 'number') {
        throw new Error('NLP processing failed to produce valid sentiment analysis');
      }

      this.sentiment = {
        score: nlp.sentimentScore,
        label: nlp.sentimentLabel,
        confidence: Math.min(1, Math.abs(nlp.sentimentScore) + 0.3),
        positive: nlp.sentimentScore > 0.05 ? nlp.sentimentScore : 0,
        negative: nlp.sentimentScore < -0.05 ? Math.abs(nlp.sentimentScore) : 0,
        neutral: Math.max(0, 1 - Math.abs(nlp.sentimentScore)),
      };
      this.predictedSideEffects = nlp.predictedSideEffects || [];
      this.isAnalysed = true;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// ── Post-Save Middleware ───────────────────────────────────────────────────────

/**
 * When a new review is saved, flag the parent Drug for re-aggregation.
 * Does NOT await — fire-and-forget to avoid slowing down review writes.
 */
ReviewSchema.post('save', function flagDrugForAggregation(doc) {
  if (doc.isNew) {
    mongoose
      .model('Drug')
      .updateOne({ _id: doc.drug }, { $set: { isAggregated: false } })
      .exec()
      .catch(() => {}); // Silently ignore; aggregation job will handle it
  }
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Returns the top N predicted side effects by confidence.
 * @param {number} [n=5]
 * @returns {Array}
 */
ReviewSchema.methods.topSideEffects = function topSideEffects(n = 5) {
  return [...this.predictedSideEffects]
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, n);
};

/**
 * Returns a short excerpt of the review text.
 * @param {number} [length=200]
 * @returns {string}
 */
ReviewSchema.methods.excerpt = function excerpt(length = 200) {
  const text = this.cleanedReview || this.review;
  if (!text || text.length <= length) return text;
  return `${text.slice(0, length).trim()}…`;
};

/**
 * Mark this review as analysed by the NLP pipeline.
 * Does NOT save — caller must save separately.
 */
ReviewSchema.methods.markAsAnalysed = function markAsAnalysed() {
  this.isAnalysed = true;
  return this;
};

// ── Static Methods ─────────────────────────────────────────────────────────────

/**
 * Fetch unanalysed reviews in batches for the NLP pipeline.
 * @param {number} [batchSize=500]
 * @param {number} [skip=0]
 */
ReviewSchema.statics.findUnanalysed = function findUnanalysed(
  batchSize = 500,
  skip = 0
) {
  return this.find({ isAnalysed: false })
    .skip(skip)
    .limit(batchSize)
    .select('review cleanedReview drug drugName')
    .lean()
    .exec();
};

/**
 * Compute rating distribution for a drug (used by aggregation jobs).
 * @param {import('mongoose').Types.ObjectId} drugId
 * @returns {Promise<Array>}
 */
ReviewSchema.statics.getRatingDistribution = function getRatingDistribution(
  drugId
) {
  return this.aggregate([
    { $match: { drug: drugId } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
        avgUseful: { $avg: '$usefulCount' },
      },
    },
    { $sort: { _id: 1 } },
  ]).exec();
};

/**
 * Compute condition-level stats for a drug.
 * @param {import('mongoose').Types.ObjectId} drugId
 * @param {number} [limit=20]
 */
ReviewSchema.statics.getConditionStats = function getConditionStats(
  drugId,
  limit = 20
) {
  return this.aggregate([
    { $match: { drug: drugId, condition: { $ne: null } } },
    {
      $group: {
        _id: '$condition',
        reviewCount: { $sum: 1 },
        avgRating: { $avg: '$rating' },
        avgSentiment: { $avg: '$sentiment.score' },
      },
    },
    { $sort: { reviewCount: -1 } },
    { $limit: limit },
    {
      $project: {
        name: '$_id',
        reviewCount: 1,
        avgRating: { $round: ['$avgRating', 2] },
        avgSentiment: { $round: ['$avgSentiment', 3] },
        _id: 0,
      },
    },
  ]).exec();
};

/**
 * Compute overall sentiment stats for a drug.
 * @param {import('mongoose').Types.ObjectId} drugId
 */
ReviewSchema.statics.getSentimentStats = function getSentimentStats(drugId) {
  return this.aggregate([
    { $match: { drug: drugId, isAnalysed: true } },
    {
      $group: {
        _id: '$sentiment.label',
        count: { $sum: 1 },
        avgScore: { $avg: '$sentiment.score' },
      },
    },
  ]).exec();
};

const Review = mongoose.model('Review', ReviewSchema);

module.exports = Review;
