const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

const limiter = ({ windowMs, limit }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7', // RateLimit-* headers plus Retry-After
    legacyHeaders: false,
    handler: (req, res, next) => next(ApiError.tooManyRequests()),
  });

// Generous global cap; Step 9 adds a stricter one for POST /tokens
exports.limiter = limiter;
exports.globalLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 1000 });