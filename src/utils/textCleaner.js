// ─── utils/textCleaner.js ───────────────────────────────────────────────────
// Text cleaning and normalization utility for patient drug reviews.
// Decodes HTML entities, strips HTML tags, normalizes whitespace and special characters
// while preserving original review text intact for auditability.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

/**
 * Common HTML Entity Mapping
 */
const HTML_ENTITIES = {
  '&#039;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&#39;': "'",
  '&#34;': '"',
  '&#38;': '&',
  '&#60;': '<',
  '&#62;': '>',
};

/**
 * Decode HTML entities in text
 * @param {string} text
 * @returns {string}
 */
const decodeHTMLEntities = (text) => {
  if (!text) return '';
  let str = text;
  Object.keys(HTML_ENTITIES).forEach((entity) => {
    str = str.replace(new RegExp(entity, 'g'), HTML_ENTITIES[entity]);
  });
  // Handle general numeric entities &#123;
  str = str.replace(/&#(\d+);/g, (_match, dec) => String.fromCharCode(dec));
  // Handle general hex entities &#x1a;
  str = str.replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
  return str;
};

/**
 * Clean review text:
 * 1. Decodes HTML entities (e.g. &#039; -> ')
 * 2. Removes HTML tags (e.g. <br />, <p>)
 * 3. Normalizes line breaks and whitespace
 * 4. Strips non-printable ASCII characters
 * 5. Trims leading/trailing whitespace
 *
 * @param {string} rawReview - Original raw review text from dataset
 * @returns {string} Cleaned and normalized text
 */
const cleanReviewText = (rawReview) => {
  if (!rawReview || typeof rawReview !== 'string') return '';

  let text = rawReview;

  // 1. Decode HTML entities
  text = decodeHTMLEntities(text);

  // 2. Remove HTML tags
  text = text.replace(/<[^>]*>/g, ' ');

  // 3. Remove non-printable / control characters (keep standard ASCII + Latin)
  text = text.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 4. Normalize multiple spaces, tabs, and newlines into single spaces
  text = text.replace(/\s+/g, ' ');

  // 5. Trim
  return text.trim();
};

/**
 * Normalize condition string (strips HTML and extra whitespace)
 * @param {string} rawCondition
 * @returns {string|null}
 */
const cleanConditionText = (rawCondition) => {
  if (!rawCondition || typeof rawCondition !== 'string') return null;
  const cleaned = cleanReviewText(rawCondition);
  if (!cleaned || cleaned.toLowerCase() === 'not listed') return null;
  return cleaned;
};

module.exports = {
  cleanReviewText,
  cleanConditionText,
  decodeHTMLEntities,
};
