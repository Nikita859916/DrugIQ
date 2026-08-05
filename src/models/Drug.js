// ─── models/Drug.js ──────────────────────────────────────────────────────────
// Drug collection — one document per unique drugName from the Kaggle CSV.
//
// This collection stores ONLY aggregated / computed information.
// Raw per-review data lives in the Review collection.
//
// Fields sourced from aggregation pipeline (run after seeding):
//   averageRating, reviewCount, conditions, commonSideEffects,
//   sentimentScore, positiveReviews, neutralReviews, negativeReviews,
//   riskCluster, summary
//
// Similarity-cache fields (written once by the similarity pipeline,
// read at O(1) cost by the API — no join or real-time computation needed):
//   riskScore, similarDrugs
//
// The drug name (lowercase slug) is indexed for fast text search and
// is used as the human-readable external identifier in URLs.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

// ── Sub-schema: Side Effect ───────────────────────────────────────────────────
const SideEffectSchema = new Schema(
  {
    /** Side-effect label exactly as extracted from reviews */
    effect: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    /** Number of reviews mentioning this side effect */
    frequency: {
      type: Number,
      required: true,
      min: [0, 'Frequency cannot be negative'],
      default: 0,
    },

    /** Percentage of all reviews for this drug mentioning the effect */
    frequencyPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    /** NLP or rule-based severity classification */
    severity: {
      type: String,
      enum: {
        values: ['mild', 'moderate', 'severe', 'unknown'],
        message: 'Severity must be mild | moderate | severe | unknown',
      },
      default: 'unknown',
    },
  },
  { _id: false }
);

// ── Sub-schema: Condition Stats ───────────────────────────────────────────────
const ConditionStatSchema = new Schema(
  {
    /** Condition name as it appears in the dataset */
    name: {
      type: String,
      required: true,
      trim: true,
    },

    /** Number of reviews for this drug under this condition */
    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Average rating for this drug under this specific condition */
    avgRating: {
      type: Number,
      min: 1,
      max: 10,
      default: null,
    },
  },
  { _id: false }
);

// ── Sub-schema: Sentiment Distribution ───────────────────────────────────────
const SentimentDistributionSchema = new Schema(
  {
    positive: { type: Number, default: 0, min: 0 },
    neutral: { type: Number, default: 0, min: 0 },
    negative: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

// ── Sub-schema: Rating Histogram ─────────────────────────────────────────────
const RatingHistogramSchema = new Schema(
  {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    5: { type: Number, default: 0 },
    6: { type: Number, default: 0 },
    7: { type: Number, default: 0 },
    8: { type: Number, default: 0 },
    9: { type: Number, default: 0 },
    10: { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Sub-schema: Similar Drug Entry ───────────────────────────────────────────
// One entry per pre-computed drug neighbour in the similarity cache.
// Written by the similarity pipeline; never mutated by the API layer.
const SimilarDrugSchema = new Schema(
  {
    /**
     * Reference to the neighbour Drug document.
     * Populated at read time via .populate('similarDrugs.drug').
     */
    drug: {
      type: Schema.Types.ObjectId,
      ref: 'Drug',
      required: [true, 'Similar drug reference is required'],
    },

    /**
     * Pre-computed cosine / Jaccard similarity score between this drug
     * and the neighbour, based on side-effect vectors and riskScore proximity.
     * Range: 0.0 (no similarity) → 1.0 (identical profile).
     * Sorted descending when stored so slicing [:N] always gives top-N.
     */
    similarityScore: {
      type: Number,
      required: [true, 'Similarity score is required'],
      min: [0, 'Similarity score cannot be below 0'],
      max: [1, 'Similarity score cannot exceed 1'],
      validate: {
        validator: (v) => Number.isFinite(v),
        message: 'Similarity score must be a finite number',
      },
    },
  },
  { _id: false } // No separate _id per entry — the drug ObjectId is the key
);

// ── Main Drug Schema ──────────────────────────────────────────────────────────
const DrugSchema = new Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────────

    /** Exact drug name as it appears in the dataset (e.g. "Levonorgestrel") */
    name: {
      type: String,
      required: [true, 'Drug name is required'],
      unique: true,
      trim: true,
      maxlength: [200, 'Drug name cannot exceed 200 characters'],
    },

    /**
     * URL-safe slug derived from name (e.g. "levonorgestrel").
     * Used as the human-readable identifier in API routes.
     */
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    /** Generic/active-ingredient name if known (populated post-seed via external API) */
    genericName: {
      type: String,
      trim: true,
      default: null,
    },

    /** Drug class / therapeutic category (populated post-seed) */
    drugClass: {
      type: String,
      trim: true,
      default: null,
    },

    // ── Aggregated Review Statistics ──────────────────────────────────────────

    /** Total number of reviews for this drug */
    reviewCount: {
      type: Number,
      default: 0,
      min: [0, 'reviewCount cannot be negative'],
      index: true,
    },

    /**
     * Arithmetic mean of all patient ratings (1–10).
     * Recomputed after each batch of reviews is ingested.
     */
    averageRating: {
      type: Number,
      default: null,
      min: [1, 'averageRating minimum is 1'],
      max: [10, 'averageRating maximum is 10'],
      index: true,
    },

    /** Distribution of ratings 1–10 */
    ratingHistogram: {
      type: RatingHistogramSchema,
      default: () => ({}),
    },

    /** Total number of "useful" votes across all reviews */
    totalUsefulCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Conditions ────────────────────────────────────────────────────────────

    /**
     * Flat list of all condition names this drug is reviewed for.
     * Derived from the unique condition values in the Review collection.
     */
    conditions: {
      type: [String],
      default: [],
      index: true,
    },

    /** Per-condition review stats (top N conditions by review count) */
    conditionStats: {
      type: [ConditionStatSchema],
      default: [],
    },

    // ── Side Effects ──────────────────────────────────────────────────────────

    /**
     * Top side effects mentioned across all reviews for this drug.
     * Populated by the NLP pipeline after seeding.
     * Sorted descending by frequency.
     */
    commonSideEffects: {
      type: [SideEffectSchema],
      default: [],
    },

    // ── Sentiment ─────────────────────────────────────────────────────────────

    /**
     * Aggregate sentiment score across all reviews.
     * Range: -1.0 (fully negative) → +1.0 (fully positive).
     * Computed by the NLP service.
     */
    sentimentScore: {
      type: Number,
      default: null,
      min: [-1, 'Sentiment score minimum is -1'],
      max: [1, 'Sentiment score maximum is 1'],
      index: true,
    },

    /** Count of reviews classified as positive (score > 0.05) */
    positiveReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Count of reviews classified as neutral (score -0.05 to 0.05) */
    neutralReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Count of reviews classified as negative (score < -0.05) */
    negativeReviews: {
      type: Number,
      default: 0,
      min: 0,
    },

    /** Percentage breakdown as a sub-document */
    sentimentDistribution: {
      type: SentimentDistributionSchema,
      default: () => ({ positive: 0, neutral: 0, negative: 0 }),
    },

    // ── Risk & Summary ────────────────────────────────────────────────────────

    /**
     * Risk classification cluster from ML/NLP pipeline.
     * Derived from side-effect severity and negative sentiment concentration.
     */
    riskCluster: {
      type: String,
      enum: {
        values: ['low', 'moderate', 'high', 'critical', 'unknown'],
        message: 'riskCluster must be low | moderate | high | critical | unknown',
      },
      default: 'unknown',
      index: true,
    },

    /**
     * Pre-computed numerical risk magnitude (0–100).
     *
     * WHY: riskCluster gives a categorical bucket (low/moderate/high/critical)
     * but offers no ordering *within* a bucket. riskScore provides a continuous
     * value so the similarity pipeline can compute meaningful numeric distance
     * between two drugs (e.g. |riskScore_A – riskScore_B|) and rank neighbours
     * precisely. It is also exposed in API responses to power risk-sorted lists
     * without any runtime aggregation.
     *
     * HOW it is computed (by the aggregation job):
     *   riskScore = weightedSeverity * 40
     *             + negativeReviewFraction * 35
     *             + (1 - normalised sentimentScore) * 25
     * Result is clamped to [0, 100] and rounded to 2 decimal places.
     *
     * Default 0 means "not yet scored" — filter on isAggregated: true
     * before using this value in production queries.
     */
    riskScore: {
      type: Number,
      default: 0,
      min: [0, 'riskScore cannot be below 0'],
      max: [100, 'riskScore cannot exceed 100'],
      validate: {
        validator: (v) => Number.isFinite(v),
        message: 'riskScore must be a finite number',
      },
      index: true,
    },

    /**
     * Pre-computed similar-drug cache — top-K neighbours sorted by
     * similarityScore descending.
     *
     * WHY: Computing drug similarity at query time requires loading every
     * drug's side-effect vector and running pairwise distance calculations
     * across 3,400+ drugs — O(N²) per request. By materialising the top-K
     * neighbours here once (offline, after seeding), the "Similar Drugs"
     * API endpoint becomes a single indexed document read + a populate(),
     * reducing latency from hundreds of milliseconds to single-digit ms.
     *
     * HOW it is populated (by the similarity pipeline):
     *   1. Build a TF-IDF / Jaccard vector from each drug's commonSideEffects.
     *   2. Incorporate riskScore proximity as a secondary signal.
     *   3. Store top-20 neighbours per drug (configurable via pipeline config).
     *   4. Re-run whenever isAggregated transitions false → true.
     *
     * Entries are stored sorted by similarityScore DESC so that
     * slicing arr.slice(0, N) always returns the top-N without extra sorting.
     *
     * Max 20 entries per drug (enforced by the pipeline, not at schema level
     * to avoid validator overhead on every save).
     */
    similarDrugs: {
      type: [SimilarDrugSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message: 'similarDrugs cannot hold more than 20 entries',
      },
    },

    /**
     * AI/NLP-generated plain-English summary of patient experience.
     * Generated after all reviews are analysed.
     */
    summary: {
      type: String,
      trim: true,
      maxlength: [2000, 'Summary cannot exceed 2000 characters'],
      default: null,
    },

    // ── Metadata ──────────────────────────────────────────────────────────────

    /**
     * Whether the aggregated statistics are up to date.
     * Set to false when new reviews are added; recomputed by a background job.
     */
    isAggregated: {
      type: Boolean,
      default: false,
      index: true,
    },

    /** ISO timestamp of last aggregation run */
    lastAggregatedAt: {
      type: Date,
      default: null,
    },

    /** Bookmark count (denormalised from Bookmark collection) */
    bookmarkCount: {
      type: Number,
      default: 0,
      min: 0,
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
DrugSchema.index({ name: 1 }, { unique: true });
DrugSchema.index({ slug: 1 }, { unique: true });
DrugSchema.index({ averageRating: -1, reviewCount: -1 });
DrugSchema.index({ sentimentScore: -1 });
DrugSchema.index({ riskCluster: 1 });
DrugSchema.index({ conditions: 1 });
DrugSchema.index({ isAggregated: 1 });

// riskScore — supports ORDER BY riskScore ASC/DESC for risk-ranked lists
// and enables range queries (e.g. riskScore < 30) without a collection scan.
DrugSchema.index({ riskScore: 1 });

// Compound: riskCluster + riskScore — covers the common query pattern:
//   "find all drugs in the 'high' cluster, sorted by exact risk magnitude"
DrugSchema.index({ riskCluster: 1, riskScore: -1 }, { name: 'idx_risk_cluster_score' });

// similarDrugs.drug — allows reverse-lookup:
//   "which drugs list drug X as a similar drug?"
// Useful for keeping the cache consistent when a drug's profile is updated.
DrugSchema.index(
  { 'similarDrugs.drug': 1 },
  { sparse: true, name: 'idx_similar_drugs_ref' }
);

// Full-text search index across name, genericName, and conditions
DrugSchema.index(
  { name: 'text', genericName: 'text', conditions: 'text' },
  {
    weights: { name: 10, genericName: 5, conditions: 2 },
    name: 'drug_text_search',
    default_language: 'english',
  }
);

// ── Virtuals ──────────────────────────────────────────────────────────────────

/** Weighted overall score combining rating and sentiment */
DrugSchema.virtual('overallScore').get(function () {
  if (this.averageRating == null || this.sentimentScore == null) return null;
  // Normalise rating to 0–1, blend 70% rating + 30% sentiment
  const normRating = (this.averageRating - 1) / 9;
  const normSentiment = (this.sentimentScore + 1) / 2;
  return Math.round((normRating * 0.7 + normSentiment * 0.3) * 100) / 100;
});

/** Percentage of positive reviews */
DrugSchema.virtual('positivePercent').get(function () {
  if (!this.reviewCount) return 0;
  return Math.round((this.positiveReviews / this.reviewCount) * 100 * 10) / 10;
});

/** Total number of condition categories covered by this drug */
DrugSchema.virtual('conditionCount').get(function () {
  return this.conditions ? this.conditions.length : 0;
});

// ── Pre-Save Middleware ────────────────────────────────────────────────────────

/**
 * Auto-generate a URL slug from the drug name before inserting.
 */
DrugSchema.pre('save', function generateSlug(next) {
  if (this.isModified('name') || this.isNew) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')    // strip special chars
      .replace(/\s+/g, '-')             // spaces → hyphens
      .replace(/-+/g, '-')              // collapse multiple hyphens
      .replace(/^-|-$/g, '');           // trim leading/trailing hyphens
  }
  next();
});

/**
 * Recompute sentimentDistribution percentages whenever the counts change.
 */
DrugSchema.pre('save', function computeSentimentDistribution(next) {
  const total =
    (this.positiveReviews || 0) +
    (this.neutralReviews || 0) +
    (this.negativeReviews || 0);

  if (total > 0) {
    this.sentimentDistribution = {
      positive: Math.round((this.positiveReviews / total) * 100 * 10) / 10,
      neutral: Math.round((this.neutralReviews / total) * 100 * 10) / 10,
      negative: Math.round((this.negativeReviews / total) * 100 * 10) / 10,
    };
  }
  next();
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Mark this drug as needing re-aggregation (called when a new review is added).
 * Does NOT save — caller must save separately.
 */
DrugSchema.methods.markForAggregation = function markForAggregation() {
  this.isAggregated = false;
  return this;
};

/**
 * Merge a new condition into the conditions array (deduped).
 * @param {string} condition
 */
DrugSchema.methods.addCondition = function addCondition(condition) {
  const normalised = condition.trim();
  if (!this.conditions.includes(normalised)) {
    this.conditions.push(normalised);
  }
  return this;
};

/**
 * Recalculate averageRating given the current total and review count.
 * Call this after a new review is ingested in real-time (before full re-aggregation).
 * @param {number} newRating - Rating from the new review (1–10)
 */
DrugSchema.methods.updateAverageRating = function updateAverageRating(newRating) {
  const prevTotal = (this.averageRating || 0) * this.reviewCount;
  this.reviewCount += 1;
  this.averageRating =
    Math.round(((prevTotal + newRating) / this.reviewCount) * 100) / 100;
  return this;
};

/**
 * Returns the top-N similar drugs from the pre-computed cache,
 * sorted by similarityScore descending (cache is already sorted,
 * so this is just a slice — no in-memory sort needed).
 * Does NOT save — caller must save.
 * @param {number} [n=10]
 * @returns {Array} slice of similarDrugs array
 */
DrugSchema.methods.getTopSimilar = function getTopSimilar(n = 10) {
  return this.similarDrugs.slice(0, n);
};

/**
 * Replace the entire similarDrugs cache with a fresh sorted array.
 * Called by the similarity pipeline after recomputing neighbours.
 * Enforces the 20-entry cap and ensures descending sort order.
 * Does NOT save — caller must save.
 * @param {Array<{ drug: ObjectId, similarityScore: number }>} entries
 * @returns {Drug} this
 */
DrugSchema.methods.setSimilarDrugs = function setSimilarDrugs(entries) {
  this.similarDrugs = [...entries]
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 20);
  return this;
};

// ── Static Methods ─────────────────────────────────────────────────────────────

/**
 * Find a drug by its URL slug.
 * @param {string} slug
 * @returns {Promise<Drug|null>}
 */
DrugSchema.statics.findBySlug = function findBySlug(slug) {
  return this.findOne({ slug: slug.toLowerCase() }).exec();
};

/**
 * Return drugs flagged as needing re-aggregation.
 * Used by the background aggregation job.
 * @param {number} [limit=100]
 */
DrugSchema.statics.findPendingAggregation = function findPendingAggregation(
  limit = 100
) {
  return this.find({ isAggregated: false }).limit(limit).exec();
};

/**
 * Top-N drugs by averageRating for a given condition.
 * @param {string} condition
 * @param {number} [limit=10]
 */
DrugSchema.statics.topDrugsForCondition = function topDrugsForCondition(
  condition,
  limit = 10
) {
  return this.find({
    conditions: condition,
    averageRating: { $ne: null },
    reviewCount: { $gte: 5 }, // Bayesian credibility threshold
  })
    .sort({ averageRating: -1, reviewCount: -1 })
    .limit(limit)
    .exec();
};

/**
 * Fetch a drug's pre-computed similar-drug list with Drug details populated.
 * This is the primary query behind the "Similar Drugs" API endpoint.
 *
 * Cost: one indexed document read + one $in lookup on ObjectIds — O(1)
 * regardless of total drug count. Compare to a naïve runtime approach that
 * would require loading all ~3,400 drug vectors and computing pairwise
 * distances on every request (O(N²) in both CPU and memory).
 *
 * @param {import('mongoose').Types.ObjectId} drugId  - The source drug
 * @param {number} [limit=10]                          - Max neighbours to return
 * @returns {Promise<object|null>}
 *
 * @example
 * const result = await Drug.findSimilar(drug._id, 6);
 * // result.similarDrugs → populated array, already sorted by score desc
 */
DrugSchema.statics.findSimilar = function findSimilar(drugId, limit = 10) {
  return this.findById(drugId)
    .select('name slug similarDrugs riskScore riskCluster')
    .populate({
      path: 'similarDrugs.drug',
      select:
        'name slug averageRating reviewCount riskCluster riskScore sentimentScore conditions',
    })
    .lean()
    .then((doc) => {
      if (!doc) return null;
      // Cache is pre-sorted DESC; slice is O(limit) — no additional sort needed
      doc.similarDrugs = (doc.similarDrugs || []).slice(0, limit);
      return doc;
    })
    .exec();
};

const Drug = mongoose.model('Drug', DrugSchema);

module.exports = Drug;
