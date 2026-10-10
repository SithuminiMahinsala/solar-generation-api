const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters');
}

const ISSUER = 'slsea-solar-api';
const AUDIENCE = 'slsea-solar-api';

function signToken(subject, claims) {
  const token = jwt.sign(claims, SECRET, {
    algorithm: 'HS256',
    subject,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  });
  const { iat, exp } = jwt.decode(token);
  return { token, expiresIn: exp - iat };
}

// The algorithm is pinned, so a token claiming "alg: none" is rejected
function verifyToken(token) {
  return jwt.verify(token, SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
}

module.exports = { signToken, verifyToken };