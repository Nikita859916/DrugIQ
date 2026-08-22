// ─── services/summaryService.js ───────────────────────────────────────────────
//
// Plain-Language Drug Summary Generator.
//
// DESIGN PHILOSOPHY
// ─────────────────
// This service has TWO generation paths that are cleanly separated:
//
//   1. deterministic()  — works entirely from already-computed Drug fields.
//                         No external calls. Works offline. Always returns
//                         something useful. Used today.
//
//   2. withLLM()        — stub for a future provider (Gemini / OpenAI / Claude).
//                         When a provider is plugged in, only this function
//                         changes. The rest of the service stays untouched.
//
// The public entry point `generateForDrug()` tries the LLM path first,
// falls back to deterministic if the provider is absent.
//
// IMPORTANT DISCLAIMERS EMBEDDED IN ALL GENERATED TEXT
// ──────────────────────────────────────────────────────
//   • Language says "patients reported" — not clinical statements
//   • No treatment recommendations are made
//   • No causation is implied
//   • Users are directed to consult a healthcare professional
//
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { Drug } = require('../models');
const logger = require('../utils/logger');
const AppError = require('../utils/AppError');

// ── Internal constants ────────────────────────────────────────────────────────

/** Maximum number of side effects to mention in a summary sentence */
const MAX_SIDE_EFFECTS_IN_SUMMARY = 3;

/** Map riskCluster enum values to friendlier display labels */
const RISK_LEVEL_LABEL = {
  low      : 'Low',
  moderate : 'Moderate',
  high     : 'High',
  critical : 'Critical',
  unknown  : 'Undetermined',
};

/** Map dominant sentiment to an opening phrase */
const SENTIMENT_OPENING = {
  positive : 'mostly positive feedback',
  neutral  : 'mixed feedback',
  negative : 'largely negative feedback',
};

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Determine the dominant sentiment label from a Drug document
 * @param {object} drug - Lean Drug document
 * @returns {'positive'|'neutral'|'negative'}
 */
const _dominantSentiment = (drug) => {
  const dist = drug.sentimentDistribution || {};
  const pos = dist.positive || 0;
  const neu = dist.neutral  || 0;
  const neg = dist.negative || 0;

  if (pos === 0 && neu === 0 && neg === 0) return 'neutral';

  if (pos >= neu && pos >= neg) return 'positive';
  if (neg >= neu && neg >= pos) return 'negative';
  return 'neutral';
};

/**
 * Format an Oxford-comma list of up to N side effects
 * @param {Array<{ effect: string }>} effects
 * @param {number} max
 * @returns {string}  e.g. "nausea, headache, and dizziness"
 */
const _formatSideEffectList = (effects = [], max = MAX_SIDE_EFFECTS_IN_SUMMARY) => {
  if (!effects.length) return '';
  const names = effects.slice(0, max).map((e) =>
    typeof e === 'string' ? e : e.effect
  );
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

// ── Core deterministic generator ──────────────────────────────────────────────

/**
 * Build a plain-language summary from pre-computed Drug fields only.
 * No external services, no ML calls, always deterministic.
 *
 * @param {object} drug - A lean or full Mongoose Drug document
 * @returns {string} A 2–4 sentence plain-language summary
 */
const deterministic = (drug) => {
  if (!drug) throw AppError.internal('summaryService.deterministic: drug is required');

  const drugName     = drug.name || 'This medication';
  const rating       = drug.averageRating != null
    ? drug.averageRating.toFixed(1)
    : null;
  const reviewCount  = drug.reviewCount  || 0;
  const sideEffects  = drug.commonSideEffects || [];
  const riskCluster  = drug.riskCluster  || 'unknown';
  const riskLabel    = RISK_LEVEL_LABEL[riskCluster] || 'Undetermined';
  const dominantSent = _dominantSentiment(drug);
  const sentLabel    = SENTIMENT_OPENING[dominantSent] || 'mixed feedback';

  const sentences = [];

  // ── Sentence 1: Review count + sentiment ────────────────────────────────
  if (reviewCount > 0) {
    sentences.push(
      `Based on ${reviewCount.toLocaleString()} patient ${
        reviewCount === 1 ? 'review' : 'reviews'
      }, ${drugName} has received ${sentLabel}.`
    );
  } else {
    sentences.push(
      `Insufficient patient reviews are available to summarise ${drugName} at this time.`
    );
  }

  // ── Sentence 2: Average rating ────────────────────────────────────────
  if (rating !== null) {
    sentences.push(
      `The average patient rating is ${rating}/10.`
    );
  }

  // ── Sentence 3: Side effects ──────────────────────────────────────────
  if (sideEffects.length > 0) {
    const effectList = _formatSideEffectList(sideEffects, MAX_SIDE_EFFECTS_IN_SUMMARY);
    const moreCount  = sideEffects.length - MAX_SIDE_EFFECTS_IN_SUMMARY;
    const moreSuffix = moreCount > 0 ? ` among others` : '';
    sentences.push(
      `Commonly mentioned side effects include ${effectList}${moreSuffix}, based on available reviews.`
    );
  } else {
    sentences.push(
      'No specific side effects have been consistently identified in the available reviews.'
    );
  }

  // ── Sentence 4: Risk level ────────────────────────────────────────────
  sentences.push(
    `Based on the analysed review patterns, the overall risk level for ${drugName} is classified as ${riskLabel}.`
  );

  // ── Disclaimer ────────────────────────────────────────────────────────
  sentences.push(
    'This summary reflects patient-reported experiences and does not constitute medical advice. ' +
    'Always consult a qualified healthcare professional before making treatment decisions.'
  );

  return sentences.join(' ');
};

// ── LLM stub ──────────────────────────────────────────────────────────────────

/**
 * Future LLM-enhanced summary generator.
 *
 * TO INTEGRATE AN LLM:
 *   1. Set process.env.LLM_PROVIDER = 'gemini' | 'openai' | 'claude'
 *   2. Implement the provider call inside this function.
 *   3. This function signature must NOT change — the rest of the service
 *      will automatically use the enhanced path.
 *
 * @param {object} drug      - Lean Drug document
 * @param {object} [options] - Future options (temperature, tone, language, etc.)
 * @returns {Promise<string|null>} LLM-generated text, or null if unavailable
 */
const withLLM = async (drug, _options = {}) => {
  const provider = process.env.LLM_PROVIDER;

  if (!provider) {
    // No provider configured — silently skip so deterministic fallback is used
    return null;
  }

  logger.info(`[SummaryService] LLM provider "${provider}" detected but not yet implemented. Falling back to deterministic summary.`);

  /* ── PLACEHOLDER: plug in provider here ──────────────────────────────────
   *
   * Example structure for a future Gemini integration:
   *
   *   const { GoogleGenerativeAI } = require('@google/generative-ai');
   *   const genAI  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
   *   const model  = genAI.getGenerativeModel({ model: 'gemini-pro' });
   *   const prompt = buildPrompt(drug);              // private helper
   *   const result = await model.generateContent(prompt);
   *   return result.response.text();
   *
   * ──────────────────────────────────────────────────────────────────────── */

  return null;
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Generate and persist a plain-language summary for a Drug.
 *
 * Execution order:
 *   1. Load Drug from DB (by ID or use the passed-in doc).
 *   2. Try LLM provider → if null, fall back to deterministic.
 *   3. Persist the result to Drug.summary field.
 *   4. Return the generated text.
 *
 * @param {import('mongoose').Types.ObjectId|string|object} drugOrId
 *   Either an ObjectId / string to look up, or a Mongoose Drug document.
 * @param {{ persist?: boolean, llmOptions?: object }} [options]
 *   persist (default true) — whether to write back to Drug.summary
 * @returns {Promise<{ summary: string, source: 'deterministic'|string }>}
 */
const generateForDrug = async (drugOrId, { persist = true, llmOptions = {} } = {}) => {
  // ── 1. Resolve the drug document ──────────────────────────────────────
  let drug;
  if (drugOrId && typeof drugOrId === 'object' && drugOrId.name) {
    // Already a populated document/lean object
    drug = drugOrId;
  } else {
    drug = await Drug.findById(drugOrId).lean().exec();
    if (!drug) {
      throw AppError.notFound(`Drug not found for summary generation (id: ${drugOrId})`);
    }
  }

  // ── 2. Attempt LLM → fallback to deterministic ───────────────────────
  let summary;
  let source = 'deterministic';

  try {
    const llmResult = await withLLM(drug, llmOptions);
    if (llmResult && typeof llmResult === 'string' && llmResult.trim().length > 0) {
      summary = llmResult.trim();
      source  = process.env.LLM_PROVIDER || 'llm';
    }
  } catch (llmErr) {
    // Never let LLM errors crash the pipeline
    logger.warn(`[SummaryService] LLM call failed, using deterministic fallback: ${llmErr.message}`);
  }

  if (!summary) {
    summary = deterministic(drug);
  }

  // ── 3. Persist back to Drug document ─────────────────────────────────
  if (persist) {
    await Drug.updateOne({ _id: drug._id }, { $set: { summary } }).exec();
  }

  return { summary, source };
};

/**
 * Batch-generate summaries for all drugs that do not yet have one.
 * Processes drugs one at a time to keep memory flat.
 *
 * @param {{ overwrite?: boolean }} [options]
 *   overwrite (default false) — re-generate even if Drug.summary already exists
 * @returns {Promise<{ processed: number, skipped: number }>}
 */
const generateForAllDrugs = async ({ overwrite = false } = {}) => {
  const filter = overwrite ? {} : { $or: [{ summary: null }, { summary: { $exists: false } }] };

  const drugs = await Drug.find(filter)
    .select('_id name averageRating reviewCount commonSideEffects sentimentDistribution riskCluster riskScore')
    .lean()
    .exec();

  logger.info(`[SummaryService] Generating summaries for ${drugs.length} drugs…`);

  let processed = 0;
  let skipped   = 0;

  for (const drug of drugs) {
    try {
      await generateForDrug(drug, { persist: true });
      processed += 1;
    } catch (err) {
      logger.warn(`[SummaryService] Skipped drug "${drug.name}": ${err.message}`);
      skipped += 1;
    }
  }

  logger.info(`[SummaryService] Done. Generated: ${processed}, Skipped: ${skipped}`);
  return { processed, skipped };
};

module.exports = {
  deterministic,
  generateForDrug,
  generateForAllDrugs,
  // Exported for unit testing or external use
  _dominantSentiment,
  _formatSideEffectList,
};
