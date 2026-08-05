// ─── models/index.js ─────────────────────────────────────────────────────────
// Model barrel — imports all Mongoose models exactly once, which guarantees
// that each model is registered with Mongoose before any query runs.
//
// Import from here in controllers and services:
//   const { Drug, Review, User, Bookmark } = require('../models');
//
// Never import individual model files directly from outside the models/
// directory — always go through this barrel so registration order is
// deterministic (important for cross-model references like $lookup).
// ────────────────────────────────────────────────────────────────────────────

'use strict';

// Registration order matters:
//   1. User     — no dependencies
//   2. Drug     — no dependencies
//   3. Review   — depends on Drug (ref)
//   4. Bookmark — depends on User + Drug (refs)
const User = require('./User');
const Drug = require('./Drug');
const Review = require('./Review');
const Bookmark = require('./Bookmark');

module.exports = {
  User,
  Drug,
  Review,
  Bookmark,
};
