const mongoose = require('mongoose');

const billingItemSchema = new mongoose.Schema({
  itemType: { type: String, required: true, enum: ['service', 'medicine', 'vaccine', 'dewormer', 'anti_rabies', 'laboratory', 'grooming', 'surgery', 'product', 'inventory', 'other'] },
  referenceId: mongoose.Schema.Types.ObjectId,
  name: { type: String, required: true },
  description: String,
  quantity: { type: Number, required: true, min: 0.01 },
  unit: { type: String, default: 'piece' },
  unitPrice: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0 }, // backend-calculated, never trusted from client
  inventoryItem: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' },
  inventoryBatch: { type: mongoose.Schema.Types.ObjectId, ref: 'InventoryBatch' },
  veterinarian: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
});

const billingSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, sparse: true, index: true }, // assigned on finalize
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true, index: true },
    pet: { type: mongoose.Schema.Types.ObjectId, ref: 'Pet', index: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    medicalRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalRecord' },

    items: [billingItemSchema],

    subtotal: { type: Number, default: 0 },
    discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    discountValue: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0 },
    discountReason: String,

    taxType: { type: String, default: 'none' },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0 },

    totalAmount: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },

    paymentStatus: { type: String, enum: ['unpaid', 'partially_paid', 'paid', 'overpaid', 'refunded'], default: 'unpaid', index: true },
    billingStatus: { type: String, enum: ['draft', 'issued', 'voided', 'cancelled', 'refunded'], default: 'draft', index: true },

    notes: String,
    issuedAt: Date,
    dueDate: Date,

    voidReason: String,
    voidedAt: Date,
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    finalizedAt: Date,
  },
  { timestamps: true }
);

billingSchema.index({ issuedAt: -1 });
billingSchema.index({ dueDate: 1 });
billingSchema.index({ owner: 1, createdAt: -1 });
billingSchema.index({ pet: 1, createdAt: -1 });

module.exports = mongoose.model('Billing', billingSchema);