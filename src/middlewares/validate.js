// ─── middlewares/validate.js ─────────────────────────────────────────────────
// Request validation middleware factory.
// Uses Mongoose-style schema validation via a provided validator function,
// but can be swapped for Joi / Zod / express-validator in the future.
//
// Usage (in a route file):
//   const { validate } = require('../middlewares/validate');
//   router.post('/drugs', validate(createDrugSchema), createDrug);
// ────────────────────────────────────────────────────────────────────────────

'use strict';

const AppError = require('../utils/AppError');

/**
 * Middleware factory that validates req.body using a provided schema function.
 *
 * The schema function should return:
 *   { error: <string|null>, value: <sanitised data> }
 *
 * @param {Function} schemaFn - (data: object) => { error, value }
 * @param {'body'|'query'|'params'} [source='body'] - Which part of req to validate
 * @returns {import('express').RequestHandler}
 */
const validate = (schemaFn, source = 'body') => (req, _res, next) => {
  const data = req[source];
  const { error, value } = schemaFn(data);

  if (error) {
    return next(AppError.unprocessable('Validation failed', error));
  }

  // Attach sanitised data back to req
  req[source] = value;
  return next();
};

module.exports = { validate };
