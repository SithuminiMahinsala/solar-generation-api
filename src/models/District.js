const mongoose = require('mongoose');

const districtSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    provinceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Province', required: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('District', districtSchema);