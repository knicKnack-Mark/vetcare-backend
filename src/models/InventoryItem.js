const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    genericName: String,
    description: String,

    category: { type: String, required: true },
    subcategory: String,
    itemType: {
      type: String, required: true,
      enum: ['medicine', 'vaccine', 'dewormer', 'anti_rabies', 'medical_supply', 'consumable', 'pet_product', 'equipment', 'other'],
    },
    unit: { type: String, required: true, enum: ['piece', 'box', 'bottle', 'vial', 'tube', 'sachet', 'pack', 'tablet', 'capsule', 'ml', 'liter', 'kg', 'gram', 'set', 'other'] },
    brand: String,
    manufacturer: String,

    quantityRemaining: { type: Number, default: 0, min: 0 },
    quantityReserved: { type: Number, default: 0, min: 0 },
    minimumStockLevel: { type: Number, default: 0, min: 0 },
    maximumStockLevel: { type: Number, min: 0 },
    reorderLevel: { type: Number, default: 0, min: 0 },
    reorderQuantity: { type: Number, min: 0 },

    unitCost: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },

    supplier: String,
    supplierContact: String,
    supplierEmail: String,
    supplierAddress: String,
    purchaseReference: String,
    invoiceNumber: String,

    storageLocation: String,
    storageCondition: String,
    temperatureRequirement: String,
    notes: String,

    status: { type: String, enum: ['active', 'inactive', 'discontinued'], default: 'active', index: true },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ name: 'text', genericName: 'text', brand: 'text' });
inventoryItemSchema.index({ category: 1 });
inventoryItemSchema.index({ itemType: 1 });
inventoryItemSchema.index({ quantityRemaining: 1 });

inventoryItemSchema.virtual('markup').get(function () {
  return this.unitCost > 0 ? Number((((this.sellingPrice - this.unitCost) / this.unitCost) * 100).toFixed(2)) : 0;
});
inventoryItemSchema.virtual('totalInventoryValue').get(function () {
  return this.quantityRemaining * this.unitCost;
});
inventoryItemSchema.virtual('stockStatus').get(function () {
  if (this.quantityRemaining <= 0) return 'out_of_stock';
  if (this.quantityRemaining <= this.reorderLevel) return 'low_stock';
  return 'in_stock';
});
inventoryItemSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);