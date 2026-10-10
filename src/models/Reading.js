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

// Main query: one installation's history, newest first
readingSchema.index({ installationId: 1, timestamp: -1 });
// Jurisdiction queries and the district summary
readingSchema.index({ districtId: 1, timestamp: -1 });
readingSchema.index({ provinceId: 1, timestamp: -1 });
// Prevent duplicate readings for the same installation and timestamp
readingSchema.index({ installationId: 1, timestamp: 1 }, { unique: true });

module.exports = mongoose.model('GenerationReading', readingSchema);