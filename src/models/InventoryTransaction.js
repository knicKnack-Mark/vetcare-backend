const mongoose = require('mongoose');

const inventoryTransactionSchema = new mongoose.Schema(
  {
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryBatch' },
    transactionType: {
      type: String, required: true,
      enum: ['purchase', 'stock_in', 'stock_out', 'usage', 'sale', 'adjustment', 'damaged', 'expired', 'returned', 'transfer', 'correction'],
    },
    quantity: { type: Number, required: true },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    unitCost: Number,
    referenceNumber: String,
    referenceType: String, // e.g. 'vaccination', 'deworming', 'manual'
    referenceId: mongoose.Schema.Types.ObjectId,
    reason: String,
    notes: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transactionDate: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

inventoryTransactionSchema.index({ inventoryItem: 1, transactionDate: -1 });

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema);