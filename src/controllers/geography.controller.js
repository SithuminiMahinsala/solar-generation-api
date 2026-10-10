const { Province, District, Substation } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { findOr404 } = require('../utils/ids');
const { serialize } = require('../utils/serialize');

const collection = (data) => ({ total: data.length, data: serialize(data) });

exports.listProvinces = asyncHandler(async (req, res) => {
  const provinces = await Province.find().sort({ name: 1 }).lean();
  res.json(collection(provinces));
});

exports.getProvince = asyncHandler(async (req, res) => {
  const province = await findOr404(Province, req.params.provinceId, 'Province');
  res.json(serialize(province));
});

exports.listDistrictsInProvince = asyncHandler(async (req, res) => {
  await findOr404(Province, req.params.provinceId, 'Province');
  const districts = await District.find({ provinceId: req.params.provinceId }).sort({ name: 1 }).lean();
  res.json(collection(districts));
});

exports.getDistrict = asyncHandler(async (req, res) => {
  const district = await findOr404(District, req.params.districtId, 'District');
  res.json(serialize(district));
});

exports.listSubstationsInDistrict = asyncHandler(async (req, res) => {
  await findOr404(District, req.params.districtId, 'District');
  const subs = await Substation.find({ districtId: req.params.districtId }).sort({ name: 1 }).lean();
  res.json(collection(subs));
});

exports.getSubstation = asyncHandler(async (req, res) => {
  const sub = await findOr404(Substation, req.params.substationId, 'Substation');
  res.json(serialize(sub));
});