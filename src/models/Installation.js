const mongoose = require('mongoose');

const installationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    meterId: { type: String, required: true, unique: true, trim: true }, // attribute, NOT a Device entity
    capacityKw: { type: Number, required: true, min: 0 },
    installDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
    location: {
      latitude: { type: Number, min: -90, max: 90 },
      longitude: { type: Number, min: -180, max: 180 },
      address: { type: String, trim: true },
    },

    substationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Substation', required: true, index: true },
    districtId: { type: mongoose.Schema.Types.ObjectId, ref: 'District', required: true, index: true },
    provinceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Province', required: true, index: true },

    // Device credential: hashed, never returned in responses
    deviceSecretHash: { type: String, required: true, select: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SolarInstallation', installationSchema);