const Joi = require('joi');
const ApiError = require('./ApiError');

const paginationKeys = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

function validateQuery(schema, query) {
  const { value, error } = schema.validate(query, { abortEarly: false });
  if (error) {
    throw ApiError.badRequest(
      'Invalid query parameters',
      error.details.map((d) => ({ field: d.path.join('.'), issue: d.message }))
    );
  }
  return value;
}

function buildPage(req, page, limit, total, data) {
  const lastPage = Math.max(1, Math.ceil(total / limit));
  const link = (p) => {
    const q = new URLSearchParams(req.query);
    q.set('page', p);
    q.set('limit', limit);
    return `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}?${q}`;
  };
  return {
    total,
    page,
    limit,
    data,
    links: {
      self: link(page),
      next: page < lastPage ? link(page + 1) : null,
      prev: page > 1 ? link(page - 1) : null,
    },
  };
}

module.exports = { Joi, paginationKeys, validateQuery, buildPage };