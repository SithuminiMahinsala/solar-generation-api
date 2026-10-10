const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

const limiter = (opts) =>
  rateLimit({
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) => next(ApiError.tooManyRequests()),
    ...opts,
  });

exports.limiter = limiter;
exports.globalLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 1000 });

// Only FAILED logins count, so devices that re-authenticate hourly are never blocked
exports.tokenLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === 'test',
});