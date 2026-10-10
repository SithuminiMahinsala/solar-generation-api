const Joi = require('joi');
const { Installation, Reading } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { findOr404 } = require('../utils/ids');
const { serializeReading } = require('../utils/serialize');
const { validateBody } = require('../utils/validate');
const { etagFor } = require('../utils/conditional');

// Built per request so the "not in the future" limit is always current
function readingSchema() {
  return Joi.object({
    timestamp: Joi.date().iso().max(new Date(Date.now() + 5 * 60 * 1000)).required()
      .messages({ 'date.max': 'must not be more than 5 minutes in the future' }),
    powerKw: Joi.number().min(0).max(1000).required(),
    energyKwh: Joi.number().min(0).required(),
    voltage: Joi.number().min(0).max(1000).required(),
  });
}

exports.createReading = asyncHandler(async (req, res) => {
  const inst = await findOr404(Installation, req.params.installationId, 'Installation');
  const body = validateBody(readingSchema(), req.body);

  let doc;
  try {
    doc = await Reading.create({
      ...body,
      installationId: inst._id,
      // scoping fields are copied from the installation, never from the client
      substationId: inst.substationId,
      districtId: inst.districtId,
      provinceId: inst.provinceId,
    });
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict('A reading for this installation and timestamp already exists', [
        { field: 'timestamp', issue: 'duplicate reading for this installation' },
      ]);
    }
    throw err;
  }

  const resource = serializeReading(doc.toObject());
  res
    .status(201)
    .set('Location', `${req.protocol}://${req.get('host')}${req.baseUrl}/${inst._id}/readings/${doc._id}`)
    .set('ETag', etagFor(resource))
    .set('Last-Modified', doc.createdAt.toUTCString())
    .json(resource);
});

exports.deleteReading = asyncHandler(async (req, res) => {
  await findOr404(Installation, req.params.installationId, 'Installation');
  const deleted = await Reading.findOneAndDelete({
    _id: req.params.readingId,
    installationId: req.params.installationId,
  }).lean();
  if (!deleted) {
    throw ApiError.notFound('Reading not found', [
      { field: 'readingId', issue: 'no such reading under this installation' },
    ]);
  }
  res.status(204).end();
});

// Readings are an append-only time series: no replace, no partial update
exports.notAllowed = (req, res, next) =>
  next(ApiError.methodNotAllowed(['GET', 'DELETE'], 'Readings are append-only and cannot be modified'));