const mongoose = require('mongoose');

const vaccinationSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true, index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },

    vaccineType: {
      type: String, required: true,
      enum: ['Core Vaccine', 'Non-Core Vaccine', 'Puppy Vaccine', 'Kitten Vaccine', 'Annual Booster', 'Rabies', 'Other'],
    },
    vaccineName: { type: String, required: true }, // configurable, kept as free text with suggested options in UI
    manufacturer: String,
    batchNumber: String,
    lotNumber: String,
    expirationDate: Date,

    administrationDate: { type: Date, required: true, index: true },
    nextDueDate: { type: Date, index: true },

    dose: String,
    route: { type: String, enum: ['Subcutaneous', 'Intramuscular', 'Intranasal', 'Oral', 'Other'] },
    administrationSite: String,

    veterinarian: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    status: { type: String, enum: ['administered', 'scheduled', 'cancelled', 'voided'], default: 'administered', index: true },

    reaction: { type: String, enum: ['None', 'Mild swelling', 'Mild fever', 'Lethargy', 'Vomiting', 'Allergic reaction', 'Other'], default: 'None' },
    notes: String,

    reminder: {
      enabled: { type: Boolean, default: true },
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null },
    },

    voidReason: String,
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

vaccinationSchema.index({ pet: 1, administrationDate: -1 });
vaccinationSchema.index({ pet: 1, nextDueDate: 1 });
vaccinationSchema.index({ owner: 1, administrationDate: -1 });
vaccinationSchema.index({ nextDueDate: 1, status: 1 });

module.exports = mongoose.model('Vaccination', vaccinationSchema);