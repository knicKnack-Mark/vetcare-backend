const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true, index: true },

    name: { type: String, required: true, trim: true },
    petType: { type: String, enum: ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'], required: true },
    breed: { type: String, trim: true },
    sex: { type: String, enum: ['Male', 'Female'], required: true },

    birthDate: { type: Date },
    color: { type: String, trim: true },
    weight: { type: Number },
    photo: { type: String },

    allergies: { type: String, trim: true },
    existingConditions: { type: String, trim: true },
    medicalNotes: { type: String, trim: true },

    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  },
  { timestamps: true }
);

petSchema.index({ name: 'text', breed: 'text' });

module.exports = mongoose.model('Pet', petSchema);