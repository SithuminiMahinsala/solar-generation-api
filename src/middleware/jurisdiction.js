const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Province, District } = require('../models');

const DENY = { _id: { $in: [] } }; // matches nothing

// Where does this document sit in the hierarchy?
function scopeOf(Model, doc) {
  if (Model === Province) return { provinceId: doc._id, districtId: null };
  if (Model === District) return { provinceId: doc.provinceId, districtId: doc._id };
  return { provinceId: doc.provinceId, districtId: doc.districtId };
}

function allowed(auth, s) {
  switch (auth.level) {
    case 'national': return true;
    case 'province': return String(s.provinceId) === auth.jurisdictionId;
    case 'district': return s.districtId != null && String(s.districtId) === auth.jurisdictionId;
    default: return false; // deny by default
  }
}

const canAccess = (auth, Model, doc) => allowed(auth, scopeOf(Model, doc));

// Mongo filter limiting a collection to the caller's jurisdiction
function scopeFilter(auth, Model) {
  switch (auth.level) {
    case 'national': return {};
    case 'province':
      if (Model === Province) return { _id: auth.jurisdictionId };
      return { provinceId: auth.jurisdictionId };
    case 'district':
      if (Model === Province) return DENY;
      if (Model === District) return { _id: auth.jurisdictionId };
      return { districtId: auth.jurisdictionId };
    default: return DENY;
  }
}

// Route guard for :param ids. Missing document: let the controller return 404.
const guard = (Model, param, label) =>
  asyncHandler(async (req, res, next) => {
    const doc = await Model.findById(req.params[param]).select('provinceId districtId').lean();
    if (!doc) return next();
    if (!canAccess(req.auth, Model, doc)) {
      throw ApiError.forbidden(`This ${label.toLowerCase()} is outside your jurisdiction`, [
        { field: param, issue: 'outside your jurisdiction' },
      ]);
    }
    next();
  });

module.exports = { guard, scopeFilter, canAccess };