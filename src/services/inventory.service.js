const InventoryItem = require('../models/InventoryItem');
const InventoryBatch = require('../models/InventoryBatch');
const InventoryTransaction = require('../models/InventoryTransaction');

const DEFAULT_EXPIRY_WARNING_DAYS = 30;

const getExpirationStatus = (expirationDate, warningDays = DEFAULT_EXPIRY_WARNING_DAYS) => {
  if (!expirationDate) return 'no_expiration';
  const now = new Date();
  const exp = new Date(expirationDate);
  if (exp < now) return 'expired';
  const warningDate = new Date(now.getTime() + warningDays * 86400000);
  if (exp <= warningDate) return 'expiring_soon';
  return 'valid';
};

// FEFO: pick the batch with the earliest expiration date that still has stock and isn't expired
const selectFefoBatch = async (inventoryItemId, quantityNeeded) => {
  const now = new Date();
  const batches = await InventoryBatch.find({
    inventoryItem: inventoryItemId,
    quantityRemaining: { $gt: 0 },
    status: { $ne: 'inactive' },
    $or: [{ expirationDate: { $gte: now } }, { expirationDate: null }],
  }).sort({ expirationDate: 1 });

  return batches[0] || null;
};

const createTransaction = async ({ inventoryItem, batch, transactionType, quantity, previousQuantity, newQuantity, unitCost, referenceNumber, referenceType, referenceId, reason, notes, performedBy }) => {
  return InventoryTransaction.create({
    inventoryItem, batch, transactionType, quantity, previousQuantity, newQuantity,
    unitCost, referenceNumber, referenceType, referenceId, reason, notes, performedBy,
  });
};

module.exports = { getExpirationStatus, selectFefoBatch, createTransaction, DEFAULT_EXPIRY_WARNING_DAYS };