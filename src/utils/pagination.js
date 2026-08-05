// ─── utils/pagination.js ─────────────────────────────────────────────────────
// Helper to extract and validate page / limit query params.
// Returns safe integers that Mongoose queries can use directly.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { PAGINATION } = require('../constants');

/**
 * Parse and clamp pagination query params from a request.
 *
 * @param {import('express').Request} req
 * @returns {{ page: number, limit: number, skip: number }}
 *
 * @example
 * const { page, limit, skip } = parsePagination(req);
 * const docs = await Model.find(filter).skip(skip).limit(limit);
 */
const parsePagination = (req) => {
  const page = Math.max(
    1,
    parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE
  );

  const limit = Math.min(
    PAGINATION.MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT)
  );

  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Parse sort field and direction from query params.
 *
 * @param {import('express').Request} req
 * @param {string[]} allowedFields - Whitelist of sortable field names
 * @param {string}   defaultField  - Default sort field
 * @returns {{ sortField: string, sortOrder: 1 | -1, sortObj: object }}
 */
const parseSort = (req, allowedFields = [], defaultField = 'createdAt') => {
  const rawField = req.query.sortBy || defaultField;
  const sortField = allowedFields.includes(rawField) ? rawField : defaultField;

  const direction = (req.query.sort || 'desc').toLowerCase();
  const sortOrder = direction === 'asc' ? 1 : -1;

  return {
    sortField,
    sortOrder,
    sortObj: { [sortField]: sortOrder },
  };
};

module.exports = { parsePagination, parseSort };
