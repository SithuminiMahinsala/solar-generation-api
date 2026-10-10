const { District, Installation, Reading } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { findOr404 } = require('../utils/ids');
const { sendJson } = require('../utils/conditional');

const SL_OFFSET_MS = 5.5 * 60 * 60 * 1000; // Asia/Colombo, UTC+5:30 (no DST)
const DAY_MS = 24 * 60 * 60 * 1000;
const round = (n) => Number((n || 0).toFixed(3));

exports.getDistrictSummary = asyncHandler(async (req, res) => {
  // findOr404 returns a lean document, so district._id is already an ObjectId.
  // aggregate() does NOT cast strings to ObjectIds the way find() does,
  // so always match on district._id, never on req.params.districtId.
  const district = await findOr404(District, req.params.districtId, 'District');
  const districtId = district._id;

  const [instStats] = await Installation.aggregate([
    { $match: { districtId } },
    { $group: { _id: null, total: { $sum: 1 }, capacityKw: { $sum: '$capacityKw' } } },
  ]);

  const base = {
    districtId: String(district._id),
    districtName: district.name,
    installations: { total: instStats?.total || 0, reporting: 0 },
    installedCapacityKw: round(instStats?.capacityKw),
  };

  // Newest reading in the district (uses the districtId + timestamp index)
  const newest = await Reading.findOne({ districtId })
    .sort({ timestamp: -1, _id: -1 })
    .select('timestamp')
    .lean();

  if (!newest) {
    return sendJson(req, res, {
      ...base, asOf: null, day: null, currentPowerKw: 0, todayEnergyKwh: 0,
    }, district.updatedAt);
  }

  const asOf = newest.timestamp;
  const dayStart = Math.floor((asOf.getTime() + SL_OFFSET_MS) / DAY_MS) * DAY_MS - SL_OFFSET_MS;
  const dayEnd = dayStart + DAY_MS;

  const [[latest], [energy]] = await Promise.all([
    // Operational: latest reading per installation, then sum
    Reading.aggregate([
      { $match: { districtId } },
      { $sort: { timestamp: -1, _id: -1 } },
      { $group: { _id: '$installationId', powerKw: { $first: '$powerKw' } } },
      { $group: { _id: null, currentPowerKw: { $sum: '$powerKw' }, reporting: { $sum: 1 } } },
    ]),
    // Cumulative counter: per-installation (max - min) over today, then sum
    Reading.aggregate([
      { $match: { districtId, timestamp: { $gte: new Date(dayStart), $lt: new Date(dayEnd) } } },
      { $group: { _id: '$installationId', min: { $min: '$energyKwh' }, max: { $max: '$energyKwh' } } },
      { $group: { _id: null, todayEnergyKwh: { $sum: { $subtract: ['$max', '$min'] } } } },
    ]),
  ]);

  sendJson(
    req,
    res,
    {
      ...base,
      installations: { total: base.installations.total, reporting: latest?.reporting || 0 },
      asOf,
      day: {
        date: new Date(dayStart + SL_OFFSET_MS).toISOString().slice(0, 10),
        timezone: 'Asia/Colombo',
        from: new Date(dayStart),
        to: new Date(dayEnd),
      },
      currentPowerKw: round(latest?.currentPowerKw),
      todayEnergyKwh: round(energy?.todayEnergyKwh),
    },
    asOf
  );
});