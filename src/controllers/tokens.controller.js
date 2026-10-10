const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { Installation, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { validateBody } = require('../utils/validate');
const { signToken } = require('../utils/jwt');

// Compared against when the account doesn't exist, so response time doesn't reveal it
const DUMMY_HASH = bcrypt.hashSync('not-a-real-secret', 10);
const invalid = () => ApiError.unauthorized('Invalid credentials');

// Joi checks types, which also blocks operator injection like {"$ne": ""}
const schema = Joi.object({
  meterId: Joi.string().trim().max(40),
  deviceSecret: Joi.string().max(128),
  email: Joi.string().email({ tlds: { allow: false } }).max(200),
  password: Joi.string().max(128),
})
  .xor('meterId', 'email')
  .with('meterId', 'deviceSecret')
  .with('email', 'password')
  .without('meterId', ['email', 'password'])
  .without('email', ['meterId', 'deviceSecret']);

exports.issueToken = asyncHandler(async (req, res) => {
  const body = validateBody(schema, req.body);
  let subject;
  let claims;

  if (body.meterId) {
    // Device: authenticates as its installation
    const inst = await Installation.findOne({ meterId: body.meterId })
      .select('+deviceSecretHash')
      .lean();
    const ok = await bcrypt.compare(body.deviceSecret, inst ? inst.deviceSecretHash : DUMMY_HASH);
    if (!inst || !ok) throw invalid();
    if (inst.status === 'inactive') {
      throw ApiError.forbidden('This installation is inactive and may not submit readings');
    }
    subject = String(inst._id);
    claims = { kind: 'device', scope: 'installation:write' };
  } else {
    // SLSEA user: analyst or admin
    const user = await User.findOne({ email: body.email.toLowerCase() })
      .select('+passwordHash')
      .lean();
    const ok = await bcrypt.compare(body.password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) throw invalid();
    subject = String(user._id);
    claims = {
      kind: 'user',
      scope: user.role === 'admin' ? 'analyst:read admin:write' : 'analyst:read',
      jurisdictionLevel: user.jurisdictionLevel,
    };
    if (user.jurisdictionId) claims.jurisdictionId = String(user.jurisdictionId);
  }

  const { token, expiresIn } = signToken(subject, claims);
  const response = {
    access_token: token,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: claims.scope,
  };
  if (claims.kind === 'user') {
    response.jurisdiction = { level: claims.jurisdictionLevel, id: claims.jurisdictionId || null };
  }

  res.set('Cache-Control', 'no-store').set('Pragma', 'no-cache').status(200).json(response);
});