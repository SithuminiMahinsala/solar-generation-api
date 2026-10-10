const mongoose = require('mongoose');

const substationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    capacityMva: { type: Number, required: true, min: 0 },
    districtId: { type: mongoose.Schema.Types.ObjectId, ref: 'District', required: true, index: true },
    provinceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Province', required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Substation', substationSchema);