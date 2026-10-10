const { Province, District, Substation, Installation, Reading } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { OBJECT_ID, findOr404 } = require('../utils/ids');
const { serialize, serializeReading } = require('../utils/serialize');
const { Joi, paginationKeys, validateQuery, buildPage } = require('../utils/pagination');
const { sendJson, maxDate } = require('../utils/conditional');
const { scopeFilter } = require('../middleware/jurisdiction');

const objectId = Joi.string().pattern(OBJECT_ID).messages({
  'string.pattern.base': 'must be a 24-character hexadecimal id',
});

const listSchema = Joi.object({
  ...paginationKeys,
  province: objectId,
  district: objectId,
  substation: objectId,
  meterId: Joi.string().trim().max(40),
  status: Joi.string().valid('active', 'inactive', 'maintenance'),
});

async function pagedInstallations(req, res, baseFilter = {}) {
  const q = validateQuery(listSchema, req.query);
  const query = {};
  if (q.province) query.provinceId = q.province;
  if (q.district) query.districtId = q.district;
  if (q.substation) query.substationId = q.substation;
  if (q.meterId) query.meterId = q.meterId;
  if (q.status) query.status = q.status;

  // $and: the caller's jurisdiction can never be widened by a query parameter
  const filter = { $and: [scopeFilter(req.auth, Installation), baseFilter, query] };

  const [items, total] = await Promise.all([
    Installation.find(filter)
      .sort({ name: 1, _id: 1 })
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

exports.getInstallationDetail = asyncHandler(async (req, res) => {
  const inst = await findOr404(Installation, req.params.installationId, 'Installation');
  const [substation, district, province, reading] = await Promise.all([
    Substation.findById(inst.substationId).lean(),
    District.findById(inst.districtId).lean(),
    Province.findById(inst.provinceId).lean(),
    latestReading(inst._id),
  ]);

  // A district user is outside the province's own scope, so it is not embedded
  const showProvince = req.auth.level !== 'district';

  sendJson(
    req,
    res,
    {
      ...serialize(inst),
      substation: serialize(substation),
      district: serialize(district),
      province: showProvince ? serialize(province) : null,
      lastReading: serializeReading(reading),
    },
    maxDate([
      inst.updatedAt,
      substation?.updatedAt,
      district?.updatedAt,
      showProvince ? province?.updatedAt : null,
      reading?.createdAt,
    ])
  );
});

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