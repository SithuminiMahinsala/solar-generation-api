const { Province, District, Substation } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { findOr404 } = require('../utils/ids');
const { serialize } = require('../utils/serialize');
const { sendJson, maxDate } = require('../utils/conditional');

const collection = (data) => ({ total: data.length, data: serialize(data) });

exports.listProvinces = asyncHandler(async (req, res) => {
  const provinces = await Province.find().sort({ name: 1 }).lean();
  sendJson(req, res, collection(provinces), maxDate(provinces.map((p) => p.updatedAt)));
});

exports.getProvince = asyncHandler(async (req, res) => {
  const province = await findOr404(Province, req.params.provinceId, 'Province');
  sendJson(req, res, serialize(province), province.updatedAt);
});

exports.listDistrictsInProvince = asyncHandler(async (req, res) => {
  await findOr404(Province, req.params.provinceId, 'Province');
  const districts = await District.find({ provinceId: req.params.provinceId })
    .sort({ name: 1 })
    .lean();
  sendJson(req, res, collection(districts), maxDate(districts.map((d) => d.updatedAt)));
});

exports.getDistrict = asyncHandler(async (req, res) => {
  const district = await findOr404(District, req.params.districtId, 'District');
  sendJson(req, res, serialize(district), district.updatedAt);
});

exports.listSubstationsInDistrict = asyncHandler(async (req, res) => {
  await findOr404(District, req.params.districtId, 'District');
  const subs = await Substation.find({ districtId: req.params.districtId })
    .sort({ name: 1 })
    .lean();
  sendJson(req, res, collection(subs), maxDate(subs.map((s) => s.updatedAt)));
});

exports.getSubstation = asyncHandler(async (req, res) => {
  const sub = await findOr404(Substation, req.params.substationId, 'Substation');
  sendJson(req, res, serialize(sub), sub.updatedAt);
});