// ─── models/Bookmark.js ──────────────────────────────────────────────────────
// Bookmark collection — a user's saved drugs.
//
// Design decisions:
//   - Compound unique index on (user, drug) prevents duplicate bookmarks.
//   - Pre-save and post-remove hooks keep the bookmarkCount fields in
//     sync on both the User and Drug documents (denormalisation for speed).
//   - The `note` field lets users attach private annotations.
//   - The `tags` array supports personal categorisation (e.g. "taking", "researching").
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

// ── Schema ────────────────────────────────────────────────────────────────────
const BookmarkSchema = new Schema(
  {
    // ── Relationships ─────────────────────────────────────────────────────────

    /** The user who created this bookmark */
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Bookmark must belong to a user'],
      index: true,
    },

    /** The drug being bookmarked */
    drug: {
      type: Schema.Types.ObjectId,
      ref: 'Drug',
      required: [true, 'Bookmark must reference a drug'],
      index: true,
    },

    // ── User-supplied fields ──────────────────────────────────────────────────

    /**
     * Optional private note the user can attach to the bookmark.
     * e.g. "Prescribed by Dr. Sharma for anxiety — check side effects"
     */
    note: {
      type: String,
      trim: true,
      maxlength: [1000, 'Note cannot exceed 1000 characters'],
      default: null,
    },

    /**
     * User-defined tags for personal organisation.
     * e.g. ["currently-taking", "side-effects-concern", "want-to-research"]
     */
    tags: {
      type: [String],
      default: [],
      validate: {
        validator(arr) {
          return arr.length <= 10;
        },
        message: 'A bookmark can have at most 10 tags',
      },
    },

    /** Whether this bookmark is pinned to the top of the user's list */
    isPinned: {
      type: Boolean,
      default: false,
      index: true,
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

/**
 * PRIMARY INDEX — compound unique index prevents a user from bookmarking
 * the same drug twice. Any attempt raises a Mongoose duplicate-key error.
 */
BookmarkSchema.index(
  { user: 1, drug: 1 },
  { unique: true, name: 'unique_user_drug_bookmark' }
);

// Query patterns
BookmarkSchema.index({ user: 1, createdAt: -1 });   // user's bookmark list, newest first
BookmarkSchema.index({ user: 1, isPinned: -1, createdAt: -1 }); // pinned first then newest
BookmarkSchema.index({ drug: 1 });                   // how many users bookmarked a drug
BookmarkSchema.index({ tags: 1 });                   // filter by tag

// ── Virtuals ──────────────────────────────────────────────────────────────────

/** Age of the bookmark in days */
BookmarkSchema.virtual('ageDays').get(function () {
  if (!this.createdAt) return null;
  return Math.floor((Date.now() - this.createdAt.getTime()) / 86_400_000);
});

// ── Post-Save: Increment Counters ─────────────────────────────────────────────

/**
 * After a new bookmark is created, increment bookmarkCount on both
 * the User and Drug documents.
 */
BookmarkSchema.post('save', async function incrementCounters(doc) {
  if (!doc.isNew) return; // Only run for new bookmarks

  try {
    await Promise.all([
      mongoose.model('User').updateOne(
        { _id: doc.user },
        { $inc: { bookmarkCount: 1 } }
      ),
      mongoose.model('Drug').updateOne(
        { _id: doc.drug },
        { $inc: { bookmarkCount: 1 } }
      ),
    ]);
  } catch {
    // Log is optional here; counter drift is acceptable and repairable
  }
});

// ── Post-DeleteOne: Decrement Counters ────────────────────────────────────────

/**
 * After a bookmark is deleted via deleteOne(), decrement counts.
 * Mongoose v8: this middleware receives the result context, not the doc.
 * We attach the bookmark data to the query via pre('deleteOne') below.
 */
BookmarkSchema.pre('deleteOne', { document: true, query: false }, function attachSelf(next) {
  // Attach the doc to the query context so post hook can access it
  this._docToDelete = { user: this.user, drug: this.drug };
  next();
});

BookmarkSchema.post('deleteOne', { document: true, query: false }, async function decrementCounters(doc) {
  try {
    await Promise.all([
      mongoose.model('User').updateOne(
        { _id: doc.user },
        { $inc: { bookmarkCount: -1 } }
      ),
      mongoose.model('Drug').updateOne(
        { _id: doc.drug },
        { $inc: { bookmarkCount: -1 } }
      ),
    ]);
  } catch {
    // Silently handle; a reconciliation job can fix drift
  }
});

// ── Instance Methods ──────────────────────────────────────────────────────────

/**
 * Add a tag (deduped, max 10).
 * Does NOT save — caller must save.
 * @param {string} tag
 * @returns {Bookmark} this
 */
BookmarkSchema.methods.addTag = function addTag(tag) {
  const t = tag.trim().toLowerCase();
  if (!this.tags.includes(t) && this.tags.length < 10) {
    this.tags.push(t);
  }
  return this;
};

/**
 * Remove a tag.
 * Does NOT save — caller must save.
 * @param {string} tag
 * @returns {Bookmark} this
 */
BookmarkSchema.methods.removeTag = function removeTag(tag) {
  const t = tag.trim().toLowerCase();
  this.tags = this.tags.filter((existing) => existing !== t);
  return this;
};

/**
 * Toggle the isPinned flag.
 * Does NOT save — caller must save.
 * @returns {Bookmark} this
 */
BookmarkSchema.methods.togglePin = function togglePin() {
  this.isPinned = !this.isPinned;
  return this;
};

// ── Static Methods ─────────────────────────────────────────────────────────────

/**
 * Check whether a specific user has already bookmarked a drug.
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {import('mongoose').Types.ObjectId} drugId
 * @returns {Promise<boolean>}
 */
BookmarkSchema.statics.isBookmarked = async function isBookmarked(
  userId,
  drugId
) {
  const count = await this.countDocuments({ user: userId, drug: drugId });
  return count > 0;
};

/**
 * Get all bookmark documents for a user, newest first, with Drug populated.
 * @param {import('mongoose').Types.ObjectId} userId
 * @param {{ page?: number, limit?: number, pinned?: boolean }} [opts]
 */
BookmarkSchema.statics.findByUser = function findByUser(
  userId,
  { page = 1, limit = 20, pinned = false } = {}
) {
  const filter = { user: userId };
  if (pinned) filter.isPinned = true;

  return this.find(filter)
    .sort({ isPinned: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('drug', 'name slug averageRating reviewCount riskCluster')
    .exec();
};

/**
 * Return the N most-bookmarked drugs (for a "trending" endpoint).
 * @param {number} [limit=10]
 * @returns {Promise<Array>}
 */
BookmarkSchema.statics.getMostBookmarked = function getMostBookmarked(
  limit = 10
) {
  return this.aggregate([
    {
      $group: {
        _id: '$drug',
        bookmarkCount: { $sum: 1 },
      },
    },
    { $sort: { bookmarkCount: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'drugs',
        localField: '_id',
        foreignField: '_id',
        as: 'drug',
      },
    },
    { $unwind: '$drug' },
    {
      $project: {
        drug: { name: 1, slug: 1, averageRating: 1, riskCluster: 1 },
        bookmarkCount: 1,
        _id: 0,
      },
    },
  ]).exec();
};

const Bookmark = mongoose.model('Bookmark', BookmarkSchema);

module.exports = Bookmark;
