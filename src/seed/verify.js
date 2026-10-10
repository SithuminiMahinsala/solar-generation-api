require('dotenv').config();
const mongoose = require('mongoose');
const { Province, District, Substation, Installation, Reading, User } = require('../models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  console.log('Counts:');
  for (const [name, m] of Object.entries({ Province, District, Substation, Installation, Reading, User })) {
    console.log(`  ${name}: ${await m.countDocuments()}`);
  }

  // Every installation should have the same number of readings
  const perInstallation = await Reading.aggregate([
    { $group: { _id: '$installationId', n: { $sum: 1 } } },
    { $group: { _id: '$n', installations: { $sum: 1 } } },
  ]);
  console.log('Readings per installation (n -> installations):', perInstallation);

  // Installation hierarchy must match its substation's district and province
  const mismatches = await Installation.aggregate([
    { $lookup: { from: 'substations', localField: 'substationId', foreignField: '_id', as: 's' } },
    { $unwind: '$s' },
    { $match: { $expr: { $or: [
      { $ne: ['$districtId', '$s.districtId'] },
      { $ne: ['$provinceId', '$s.provinceId'] },
    ] } } },
    { $count: 'mismatches' },
  ]);
  console.log('Hierarchy mismatches:', mismatches[0]?.mismatches || 0);

  const range = await Reading.aggregate([
    { $group: { _id: null, first: { $min: '$timestamp' }, last: { $max: '$timestamp' } } },
  ]);
  console.log('Reading time range:', range[0]);

  await mongoose.disconnect();
})();