const mongoose = require('mongoose');

const ownerSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, required: true, trim: true },
    suffix: { type: String, trim: true },

    mobileNumber: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    alternateContactNumber: { type: String, trim: true },

    address: {
      houseStreet: String,
      barangay: String,
      municipality: { type: String, required: true },
      province: { type: String, required: true },
      zipCode: String,
    },

    preferredContactMethod: { type: String, enum: ['sms', 'call', 'email'], default: 'sms' },

    notes: { type: String, trim: true },

    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
  },
  { timestamps: true }
);

ownerSchema.index({ lastName: 1 });
ownerSchema.index({ firstName: 'text', middleName: 'text', lastName: 'text' });

ownerSchema.virtual('fullName').get(function () {
  return [this.firstName, this.middleName, this.lastName, this.suffix].filter(Boolean).join(' ');
});
ownerSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Owner', ownerSchema);