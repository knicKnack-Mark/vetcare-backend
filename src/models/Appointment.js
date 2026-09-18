const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true, index: true },

    appointmentType: {
      type: String,
      required: true,
      enum: ['Checkup', 'Vaccination', 'Deworming', 'Anti-Rabies', 'Follow-up', 'Consultation', 'Surgery', 'Laboratory', 'Grooming', 'Emergency', 'Other'],
    },
    service: { type: String, trim: true },
    title: { type: String, trim: true },

    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true }, // "HH:mm"
    endTime: { type: String, required: true },
    duration: { type: Number },

    reason: { type: String, trim: true },
    notes: { type: String, trim: true },

    status: {
      type: String,
      enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
      default: 'scheduled',
      index: true,
    },
    priority: { type: String, enum: ['normal', 'urgent', 'emergency'], default: 'normal' },

    veterinarian: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },

    reminder: {
      enabled: { type: Boolean, default: true },
      sent: { type: Boolean, default: false },
      sentAt: { type: Date, default: null },
    },

    cancellation: {
      reason: String,
      cancelledAt: Date,
      cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },

    completion: {
      completedAt: Date,
      completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
  },
  { timestamps: true }
);

appointmentSchema.index({ date: 1, status: 1 });
appointmentSchema.index({ veterinarian: 1, date: 1 });
appointmentSchema.index({ pet: 1, date: 1 });
appointmentSchema.index({ owner: 1, date: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);