// ─── utils/apiResponse.js ────────────────────────────────────────────────────
// Standardised response helpers.
// All controller responses MUST go through these helpers to guarantee a
// consistent JSON envelope across the entire API.
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const { PAGINATION } = require('../constants');

/**
 * Send a successful response.
 *
 * @param {import('express').Response} res
 * @param {object} options
 * @param {*}      options.data        - Payload to return
 * @param {string} [options.message]   - Human-readable message
 * @param {number} [options.statusCode=200]
 */
const sendSuccess = (res, { data = null, message = 'Success', statusCode = 200 } = {}) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send a paginated list response.
 *
 * @param {import('express').Response} res
 * @param {object} options
 * @param {Array}  options.data          - Array of items for the current page
 * @param {number} options.total         - Total number of items (all pages)
 * @param {number} [options.page]        - Current page (defaults to query param)
 * @param {number} [options.limit]       - Items per page (defaults to query param)
 * @param {string} [options.message]
 * @param {number} [options.statusCode=200]
 */
const sendPaginated = (
  res,
  {
    data = [],
    total = 0,
    page = PAGINATION.DEFAULT_PAGE,
    limit = PAGINATION.DEFAULT_LIMIT,
    message = 'Success',
    statusCode = 200,
  } = {}
) => {
  const totalPages = Math.ceil(total / limit);

  res
    .status(statusCode)
    // Expose total count in header for clients that want it
    .set('X-Total-Count', String(total))
    .set('X-Page', String(page))
    .set('X-Limit', String(limit))
    .set('X-Total-Pages', String(totalPages))
    .json({
      success: true,
      message,
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
};

/**
 * Send a 201 Created response.
 *
 * @param {import('express').Response} res
 * @param {*}      data
 * @param {string} [message='Resource created successfully']
 */
const sendCreated = (res, data, message = 'Resource created successfully') => {
  sendSuccess(res, { data, message, statusCode: 201 });
};

/**
 * Send a 204 No Content response.
 *
 * @param {import('express').Response} res
 */
const sendNoContent = (res) => {
  res.status(204).send();
};

module.exports = { sendSuccess, sendPaginated, sendCreated, sendNoContent };
