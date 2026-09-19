const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    billing: { type: mongoose.Schema.Types.ObjectId, ref: 'Billing', required: true, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    amount: { type: Number, required: true, min: 0.01 },
    reason: { type: String, required: true },
    refundMethod: { type: String, enum: ['cash', 'gcash', 'maya', 'bank_transfer', 'credit_card', 'debit_card', 'other'], required: true },
    referenceNumber: String,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    refundDate: { type: Date, default: Date.now },
    notes: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Refund', refundSchema);