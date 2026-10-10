const { Province, District, Substation, Installation, Reading } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { OBJECT_ID, findOr404 } = require('../utils/ids');
const { serialize, serializeReading } = require('../utils/serialize');
const { Joi, paginationKeys, validateQuery, buildPage } = require('../utils/pagination');
const { sendJson, maxDate } = require('../utils/conditional');

const objectId = Joi.string().pattern(OBJECT_ID).messages({
  'string.pattern.base': 'must be a 24-character hexadecimal id',
});

const listSchema = Joi.object({
  ...paginationKeys,
  province: objectId,
  district: objectId,
  substation: objectId,
  status: Joi.string().valid('active', 'inactive', 'maintenance'),
})

async function pagedInstallations(req, res, baseFilter = {}) {
  const q = validateQuery(listSchema, req.query);
  const filter = { ...baseFilter };
  if (q.province) filter.provinceId = q.province;
  if (q.district) filter.districtId = q.district;
  if (q.substation) filter.substationId = q.substation;
  if (q.status) filter.status = q.status;

  const [items, total] = await Promise.all([
    Installation.find(filter)
      .sort({ name: 1, _id: 1 }) // _id tie-breaker keeps pages stable
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    Installation.countDocuments(filter),
  ]);

  sendJson(
    req,
    res,
    buildPage(req, q.page, q.limit, total, serialize(items)),
    maxDate(items.map((i) => i.updatedAt))
  );
}

exports.listInstallations = asyncHandler((req, res) => pagedInstallations(req, res));

exports.listInstallationsInSubstation = asyncHandler(async (req, res) => {
  await findOr404(Substation, req.params.substationId, 'Substation');
  await pagedInstallations(req, res, { substationId: req.params.substationId });
});

exports.getInstallation = asyncHandler(async (req, res) => {
  const inst = await findOr404(Installation, req.params.installationId, 'Installation');
  sendJson(req, res, serialize(inst), inst.updatedAt);
});

const latestReading = (installationId) =>
  Reading.findOne({ installationId }).sort({ timestamp: -1 }).lean();

// Composite resource: installation plus its most relevant related data
exports.getInstallationDetail = asyncHandler(async (req, res) => {
  const inst = await findOr404(Installation, req.params.installationId, 'Installation');
  const [substation, district, province, reading] = await Promise.all([
    Substation.findById(inst.substationId).lean(),
    District.findById(inst.districtId).lean(),
    Province.findById(inst.provinceId).lean(),
    latestReading(inst._id),
  ]);

  sendJson(
    req,
    res,
    {
      ...serialize(inst),
      substation: serialize(substation),
      district: serialize(district),
      province: serialize(province),
      lastReading: serializeReading(reading),
    },
    maxDate([
      inst.updatedAt,
      substation?.updatedAt,
      district?.updatedAt,
      province?.updatedAt,
      reading?.createdAt,
    ])
  );
});

// Derived resource: the single most recent reading
exports.getLastReading = asyncHandler(async (req, res) => {
  const inst = await findOr404(Installation, req.params.installationId, 'Installation');
  const reading = await latestReading(inst._id);
  if (!reading) {
    throw ApiError.notFound('No readings recorded for this installation', [
      { field: 'installationId', issue: 'installation has no readings yet' },
    ]);
  }
  sendJson(req, res, serializeReading(reading), reading.createdAt);
});