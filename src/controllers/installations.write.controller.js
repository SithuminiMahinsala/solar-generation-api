const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { Substation, Installation, Reading } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { OBJECT_ID, findOr404 } = require('../utils/ids');
const { serialize } = require('../utils/serialize');
const { validateBody } = require('../utils/validate');
const { etagFor, checkIfMatch } = require('../utils/conditional');

const objectId = Joi.string().pattern(OBJECT_ID).messages({
  'string.pattern.base': 'must be a 24-character hexadecimal id',
});

// Client-writable fields. substationId is create-only (immutable afterwards).
const fields = {
  name: Joi.string().trim().min(2).max(100),
  meterId: Joi.string().trim().pattern(/^[A-Za-z0-9-]{3,40}$/)
    .messages({ 'string.pattern.base': 'must be 3-40 letters, digits or hyphens' }),
  capacityKw: Joi.number().min(0.1).max(10000),
  installDate: Joi.date().iso(),
  status: Joi.string().valid('active', 'inactive', 'maintenance'),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
    address: Joi.string().trim().max(200),
  }),
};

const requireKeys = (keys) =>
  Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, keys.includes(k) ? v.required() : v])
  );

const createSchema = Joi.object({
  ...requireKeys(['name', 'meterId', 'capacityKw', 'installDate']),
  substationId: objectId.required(),
});
const putSchema = Joi.object(requireKeys(Object.keys(fields))); // full replacement: all required
const patchSchema = Joi.object(fields).min(1);                  // partial: at least one field

// PATCH merges nested location fields instead of replacing the object
function toPatchSet(body) {
  const set = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'location') {
      for (const [lk, lv] of Object.entries(v)) set[`location.${lk}`] = lv;
    } else {
      set[k] = v;
    }
  }
  return set;
}

const lastModified = (inst) => new Date(inst.updatedAt).toUTCString();

exports.createInstallation = asyncHandler(async (req, res) => {
  const body = validateBody(createSchema, req.body);

  const sub = await Substation.findById(body.substationId).lean();
  if (!sub) {
    throw ApiError.badRequest('Unknown substation', [
      { field: 'substationId', issue: 'no substation with this id' },
    ]);
  }

  const deviceSecret = crypto.randomBytes(16).toString('hex');
  const created = await Installation.create({
    ...body,
    districtId: sub.districtId,
    provinceId: sub.provinceId,
    deviceSecretHash: await bcrypt.hash(deviceSecret, 10),
  });

  // Re-read: a freshly created document still contains the hash,
  // while queries honour select:false
  const inst = await Installation.findById(created._id).lean();
  const resource = serialize(inst);

  res
    .status(201)
    .set('Location', `${req.protocol}://${req.get('host')}${req.baseUrl}/${inst._id}`)
    .set('ETag', etagFor(resource))
    .set('Last-Modified', lastModified(inst))
    .set('Cache-Control', 'no-store') // the response carries a one-time secret
    .json({ ...resource, deviceSecret });
});

async function applyUpdate(req, $set) {
  const current = await findOr404(Installation, req.params.installationId, 'Installation');
  checkIfMatch(req, etagFor(serialize(current)));

  // Filtering on updatedAt closes the gap between the If-Match check and the write
  const updated = await Installation.findOneAndUpdate(
    { _id: current._id, updatedAt: current.updatedAt },
    { $set },
    { new: true, runValidators: true }
  )
    .select('-deviceSecretHash')
    .lean();

  if (!updated) {
    throw ApiError.preconditionFailed('The installation was modified by another request; fetch it again and retry', [
      { field: 'installationId', issue: 'concurrent modification' },
    ]);
  }
  return updated;
}

function sendUpdated(res, inst) {
  const resource = serialize(inst);
  res.set('ETag', etagFor(resource)).set('Last-Modified', lastModified(inst)).json(resource);
}

exports.replaceInstallation = asyncHandler(async (req, res) => {
  const body = validateBody(putSchema, req.body);
  sendUpdated(res, await applyUpdate(req, body)); // location object replaced wholesale
});

exports.updateInstallation = asyncHandler(async (req, res) => {
  const body = validateBody(patchSchema, req.body);
  sendUpdated(res, await applyUpdate(req, toPatchSet(body)));
});

exports.deleteInstallation = asyncHandler(async (req, res) => {
  const inst = await findOr404(Installation, req.params.installationId, 'Installation');
  if (await Reading.exists({ installationId: inst._id })) {
    throw ApiError.conflict('Installation has recorded readings and cannot be deleted', [
      { field: 'installationId', issue: 'set status to "inactive" to retire it instead' },
    ]);
  }
  await Installation.deleteOne({ _id: inst._id });
  res.status(204).end();
});