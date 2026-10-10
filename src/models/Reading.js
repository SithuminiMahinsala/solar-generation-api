const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema(
  {
    installationId: { type: mongoose.Schema.Types.ObjectId, ref: 'SolarInstallation', required: true },
    districtId: { type: mongoose.Schema.Types.ObjectId, ref: 'District', required: true },
    provinceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Province', required: true },
    substationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Substation', required: true },

    timestamp: { type: Date, required: true },
    powerKw: { type: Number, required: true, min: 0 },
    energyKwh: { type: Number, required: true, min: 0 }, // cumulative
    voltage: { type: Number, required: true, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // append-only: no updatedAt
);

readingSchema.index({ installationId: 1, timestamp: -1 });
readingSchema.index({ substationId: 1, timestamp: -1, _id: -1 });
readingSchema.index({ districtId: 1, timestamp: -1, _id: -1 });
readingSchema.index({ provinceId: 1, timestamp: -1, _id: -1 });
readingSchema.index({ installationId: 1, timestamp: 1 }, { unique: true });

module.exports = mongoose.model('GenerationReading', readingSchema);