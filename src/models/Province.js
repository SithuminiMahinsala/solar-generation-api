const mongoose = require('mongoose');

const provinceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Province', provinceSchema);