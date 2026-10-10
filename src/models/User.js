const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['analyst', 'admin'], default: 'analyst' },

    // Read scope by jurisdiction
    jurisdictionLevel: { type: String, enum: ['national', 'province', 'district'], required: true },
    jurisdictionId: { type: mongoose.Schema.Types.ObjectId }, // required unless national
  },
  { timestamps: true }
);

userSchema.pre('validate', function (next) {
  if (this.jurisdictionLevel !== 'national' && !this.jurisdictionId) {
    return next(new Error('jurisdictionId is required for province and district users'));
  }
});

module.exports = mongoose.model('User', userSchema);