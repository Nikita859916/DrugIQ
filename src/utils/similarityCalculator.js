// ─── utils/similarityCalculator.js ──────────────────────────────────────────
// Mathematical similarity calculator.
// Provides Jaccard similarity, Cosine vector similarity, and multi-factor weighted
// drug similarity calculation.
//
// Default weights (configurable via SIMILARITY_WEIGHTS):
//   side effects  : 50%  — primary signal; patient-reported side-effect overlap
//   conditions    : 25%  — therapeutic area overlap
//   rating        : 10%  — rating closeness (least discriminating alone)
//   sentiment     : 15%  — sentiment distribution vector cosine
// ────────────────────────────────────────────────────────────────────────────

/**
 * Configurable similarity weights.
 * Must sum to 1.0. Override by passing a custom weights object to
 * calculateWeightedDrugSimilarity().
 */
const SIMILARITY_WEIGHTS = {
  sideEffects: 0.50,
  conditions: 0.25,
  rating: 0.10,
  sentiment: 0.15,
};

/**
 * Calculate Jaccard Similarity between two sets/arrays
 * J(A, B) = |A ∩ B| / |A ∪ B|
 *
 * @param {Array<string>} setA
 * @param {Array<string>} setB
 * @returns {number} Float between 0.0 and 1.0
 */
const calculateJaccardSimilarity = (setA = [], setB = []) => {
  if (!setA.length && !setB.length) return 0;
  if (!setA.length || !setB.length) return 0;

  const setAFormatted = new Set(setA.map((s) => String(s).toLowerCase().trim()));
  const setBFormatted = new Set(setB.map((s) => String(s).toLowerCase().trim()));

  let intersectionCount = 0;
  setAFormatted.forEach((item) => {
    if (setBFormatted.has(item)) intersectionCount += 1;
  });

  const unionSize = new Set([...setAFormatted, ...setBFormatted]).size;
  return unionSize === 0 ? 0 : intersectionCount / unionSize;
};

/**
 * Calculate numerical closeness score (0.0 to 1.0)
 * Closeness = 1 - (|valA - valB| / maxDiff)
 *
 * @param {number} valA
 * @param {number} valB
 * @param {number} maxDiff - Maximum possible difference (e.g., 9 for rating 1-10)
 * @returns {number} Float between 0.0 and 1.0
 */
const calculateNumericalCloseness = (valA, valB, maxDiff = 9) => {
  if (valA == null || valB == null) return 0.5; // neutral fallback
  const diff = Math.abs(valA - valB);
  return Math.max(0, 1 - diff / maxDiff);
};

/**
 * Calculate Cosine Similarity between two 3D vectors (e.g. sentiment distributions)
 *
 * @param {{ positive: number, neutral: number, negative: number }} vecA
 * @param {{ positive: number, neutral: number, negative: number }} vecB
 * @returns {number} Float between 0.0 and 1.0
 */
const calculateCosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB) return 0.5;

  const a = [vecA.positive || 0, vecA.neutral || 0, vecA.negative || 0];
  const b = [vecB.positive || 0, vecB.neutral || 0, vecB.negative || 0];

  const dotProduct = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const magA = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
  const magB = Math.sqrt(b[0] ** 2 + b[1] ** 2 + b[2] ** 2);

  if (magA === 0 || magB === 0) return 0;
  return Math.min(1, Math.max(0, dotProduct / (magA * magB)));
};

/**
 * Calculate multi-factor weighted drug similarity
 *
 * Default weights (see SIMILARITY_WEIGHTS at top of file):
 *   side effects : 50% — Jaccard similarity over canonical side-effect names
 *   conditions   : 25% — Jaccard similarity over condition strings
 *   rating       : 10% — 1 – |ratingA – ratingB| / 9
 *   sentiment    : 15% — cosine similarity of sentiment distributions
 *
 * @param {object} drugA
 * @param {object} drugB
 * @param {object} [weights] - Optional weight override (must sum to 1.0)
 * @returns {number} Similarity score rounded to 4 decimal places (0.0 to 1.0)
 */
const calculateWeightedDrugSimilarity = (drugA, drugB, weights = SIMILARITY_WEIGHTS) => {
  if (!drugA || !drugB) return 0;

  // Extract side effect name arrays from embedded sub-docs or plain strings
  const sideEffectsA = (drugA.commonSideEffects || []).map((se) => (typeof se === 'string' ? se : se.effect));
  const sideEffectsB = (drugB.commonSideEffects || []).map((se) => (typeof se === 'string' ? se : se.effect));

  // 1. Side Effect Jaccard Similarity
  const sideEffectSim = calculateJaccardSimilarity(sideEffectsA, sideEffectsB);

  // 2. Condition Jaccard Similarity
  const conditionSim = calculateJaccardSimilarity(
    drugA.conditions || [],
    drugB.conditions || [],
  );

  // 3. Average Rating Closeness (max possible diff between rating 1–10 is 9)
  const ratingSim = calculateNumericalCloseness(
    drugA.averageRating,
    drugB.averageRating,
    9,
  );

  // 4. Sentiment Distribution Cosine Similarity
  const sentimentSim = calculateCosineSimilarity(
    drugA.sentimentDistribution,
    drugB.sentimentDistribution,
  );

  // Weighted combination using configurable weights
  const totalScore = sideEffectSim * weights.sideEffects
    + conditionSim * weights.conditions
    + ratingSim * weights.rating
    + sentimentSim * weights.sentiment;

  return Math.round(totalScore * 10000) / 10000;
};

module.exports = {
  SIMILARITY_WEIGHTS,
  calculateJaccardSimilarity,
  calculateNumericalCloseness,
  calculateCosineSimilarity,
  calculateWeightedDrugSimilarity,
};
