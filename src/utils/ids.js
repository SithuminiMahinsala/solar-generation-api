const ApiError = require('./ApiError');

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Use with router.param('someId', validateId)
function validateId(req, res, next, value, name) {
  if (!OBJECT_ID.test(value)) {
    return next(
      ApiError.badRequest(`Invalid ${name}`, [
        { field: name, issue: 'must be a 24-character hexadecimal id' },
      ])
    );
  }
  next();
}

async function findOr404(Model, id, label) {
  const doc = await Model.findById(id).lean();
  if (!doc) {
    throw ApiError.notFound(`${label} not found`, [{ field: 'id', issue: `no ${label.toLowerCase()} with id ${id}` }]);
  }
  return doc;
}

module.exports = { OBJECT_ID, validateId, findOr404 };