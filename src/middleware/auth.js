const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/jwt');

const LEVELS = ['national', 'province', 'district'];

// 401: who are you? Sets req.auth
function authenticate(req, res, next) {
  const [scheme, token] = (req.get('Authorization') || '').split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return next(ApiError.unauthorized('A bearer token is required', [
      { field: 'Authorization', issue: 'expected "Bearer <token>"' },
    ]));
  }

  let p;
  try {
    p = verifyToken(token);
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired token', [
      { field: 'Authorization', issue: err.name === 'TokenExpiredError' ? 'token expired' : 'token invalid' },
    ]));
  }

  const validUser = p.kind === 'user' && LEVELS.includes(p.jurisdictionLevel) &&
    (p.jurisdictionLevel === 'national' || p.jurisdictionId);
  if (p.kind !== 'device' && !validUser) {
    return next(ApiError.unauthorized('Invalid or expired token', [
      { field: 'Authorization', issue: 'token claims are malformed' },
    ]));
  }

  req.auth = {
    kind: p.kind,
    sub: p.sub,
    scopes: String(p.scope || '').split(' ').filter(Boolean),
    level: p.jurisdictionLevel,
    jurisdictionId: p.jurisdictionId,
  };
  next();
}

// 403: I know who you are, but your token lacks the capability
const requireScope = (...needed) => (req, res, next) => {
  if (!needed.some((s) => req.auth.scopes.includes(s))) {
    return next(ApiError.forbidden('Your token does not carry the required scope', [
      { field: 'scope', issue: `requires one of: ${needed.join(', ')}` },
    ]));
  }
  next();
};

// A device may write only for the installation it authenticated as
function requireOwnInstallation(req, res, next) {
  if (req.auth.kind !== 'device' || req.auth.sub !== req.params.installationId) {
    return next(ApiError.forbidden('A device may only submit readings for its own installation', [
      { field: 'installationId', issue: 'does not match the authenticated installation' },
    ]));
  }
  next();
}

module.exports = { authenticate, requireScope, requireOwnInstallation };