const { Province, District, Substation, Installation, Reading } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { OBJECT_ID, findOr404 } = require('../utils/ids');
const { serializeReading } = require('../utils/serialize');
const { Joi, paginationKeys, validateQuery, buildPage } = require('../utils/pagination');
const { sendJson, maxDate } = require('../utils/conditional');

const objectId = Joi.string().pattern(OBJECT_ID).messages({
  'string.pattern.base': 'must be a 24-character hexadecimal id',
});

// query parameter -> Reading field
const FILTERS = {
  district: 'districtId',
  substation: 'substationId',
  installation: 'installationId',
};

function buildSchema(extraKeys) {
  const extras = {};
  extraKeys.forEach((k) => (extras[k] = objectId));
  return Joi.object({
    ...paginationKeys,
    from: Joi.date().iso(),
    to: Joi.date().iso(),
    sort: Joi.string().valid('timestamp', '-timestamp').default('-timestamp'),
    ...extras,
  }); // unknown keys are rejected on purpose
}

// One factory, four scopes: same behaviour everywhere
function makeReadingsList({ Model, label, param, scopeField, extraFilters }) {
  const schema = buildSchema(extraFilters);

  return asyncHandler(async (req, res) => {
    const q = validateQuery(schema, req.query);
    if (q.from && q.to && q.from > q.to) {
      throw ApiError.badRequest('Invalid time window', [
        { field: 'from', issue: 'must not be later than "to"' },
      ]);
    }
    await findOr404(Model, req.params[param], label); // missing parent -> 404

    const filter = { [scopeField]: req.params[param] };
    for (const [key, field] of Object.entries(FILTERS)) {
      if (q[key]) filter[field] = q[key];
    }
    if (q.from || q.to) {
      filter.timestamp = {};
      if (q.from) filter.timestamp.$gte = q.from;
      if (q.to) filter.timestamp.$lte = q.to;
    }

    const dir = q.sort.startsWith('-') ? -1 : 1;
    const [items, total] = await Promise.all([
      Reading.find(filter)
        .sort({ timestamp: dir, _id: dir }) // _id keeps pages stable
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean(),
      Reading.countDocuments(filter),
    ]);

    const body = buildPage(req, q.page, q.limit, total, items.map(serializeReading));
    sendJson(req, res, body, maxDate(items.map((r) => r.createdAt)));
  });
}

exports.listInstallationReadings = makeReadingsList({
  Model: Installation, label: 'Installation', param: 'installationId',
  scopeField: 'installationId', extraFilters: [],
});
exports.listSubstationReadings = makeReadingsList({
  Model: Substation, label: 'Substation', param: 'substationId',
  scopeField: 'substationId', extraFilters: ['installation'],
});
exports.listDistrictReadings = makeReadingsList({
  Model: District, label: 'District', param: 'districtId',
  scopeField: 'districtId', extraFilters: ['substation', 'installation'],
});
exports.listProvinceReadings = makeReadingsList({
  Model: Province, label: 'Province', param: 'provinceId',
  scopeField: 'provinceId', extraFilters: ['district', 'substation', 'installation'],
});

// One reading, only if it belongs to the installation in the URL
exports.getReading = asyncHandler(async (req, res) => {
  await findOr404(Installation, req.params.installationId, 'Installation');
  const reading = await Reading.findOne({
    _id: req.params.readingId,
    installationId: req.params.installationId,
  }).lean();
  if (!reading) {
    throw ApiError.notFound('Reading not found', [
      { field: 'readingId', issue: 'no such reading under this installation' },
    ]);
  }
  sendJson(req, res, serializeReading(reading), reading.createdAt);
});