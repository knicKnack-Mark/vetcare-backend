const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    billing: { type: mongoose.Schema.Types.ObjectId, ref: 'Billing', required: true, index: true },
    paymentNumber: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, required: true, enum: ['cash', 'gcash', 'maya', 'bank_transfer', 'credit_card', 'debit_card', 'other'] },
    referenceNumber: String,
    paymentDate: { type: Date, default: Date.now, index: true },
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    notes: String,
    status: { type: String, enum: ['completed', 'pending', 'cancelled', 'refunded'], default: 'completed' },
  },
  { timestamps: true }
);

paymentSchema.index({ billing: 1, paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);