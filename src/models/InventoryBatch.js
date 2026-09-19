const mongoose = require('mongoose');

const inventoryBatchSchema = new mongoose.Schema(
  {
    inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem', required: true, index: true },
    batchNumber: String,
    lotNumber: String,
    quantityReceived: { type: Number, required: true, min: 0 },
    quantityRemaining: { type: Number, required: true, min: 0 },
    unitCost: { type: Number, default: 0, min: 0 },
    manufacturingDate: Date,
    expirationDate: { type: Date, index: true },
    receivedDate: { type: Date, default: Date.now },
    supplier: String,
    status: { type: String, enum: ['available', 'low_stock', 'depleted', 'expired', 'inactive'], default: 'available', index: true },
  },
  { timestamps: true }
);

inventoryBatchSchema.index({ inventoryItem: 1, expirationDate: 1 });

module.exports = mongoose.model('InventoryBatch', inventoryBatchSchema);