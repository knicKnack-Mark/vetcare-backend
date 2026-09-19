const mongoose = require('mongoose');

const dewormingSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

    medicineName: { type: String, required: true },
    manufacturer: String,
    batchNumber: String,

    administrationDate: { type: Date, required: true, index: true },
    nextDueDate: { type: Date, index: true },

    weight: Number,
    dosage: String,
    route: { type: String, enum: ['Oral', 'Topical', 'Injectable', 'Other'], default: 'Oral' },

    veterinarian: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    status: { type: String, enum: ['administered', 'cancelled', 'voided'], default: 'administered', index: true },
    reaction: { type: String, enum: ['None', 'Vomiting', 'Diarrhea', 'Lethargy', 'Other'], default: 'None' },
    notes: String,

    reminder: { enabled: { type: Boolean, default: true }, sent: { type: Boolean, default: false }, sentAt: { type: Date, default: null } },

    voidReason: String,
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

dewormingSchema.index({ pet: 1, administrationDate: -1 });
dewormingSchema.index({ pet: 1, nextDueDate: 1 });
dewormingSchema.index({ owner: 1, administrationDate: -1 });

module.exports = mongoose.model('Deworming', dewormingSchema);