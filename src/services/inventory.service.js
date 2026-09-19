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

const stockOutInternal = async ({ inventoryItemId, quantity, transactionType = 'usage', referenceType, referenceId, reason, notes, performedBy }) => {
  const item = await InventoryItem.findById(inventoryItemId);
  if (!item) throw new Error('Inventory item not found');
  if (quantity > item.quantityRemaining) throw new Error(`Insufficient inventory: only ${item.quantityRemaining} remaining`);

  let remainingToDeduct = quantity;
  let usedBatch = null;
  while (remainingToDeduct > 0) {
    const batch = await selectFefoBatch(item._id, remainingToDeduct);
    if (!batch) break;
    const deductFromBatch = Math.min(batch.quantityRemaining, remainingToDeduct);
    batch.quantityRemaining -= deductFromBatch;
    batch.status = batch.quantityRemaining <= 0 ? 'depleted' : 'available';
    await batch.save();
    usedBatch = batch;
    remainingToDeduct -= deductFromBatch;
  }

  const previousQuantity = item.quantityRemaining;
  const newQuantity = previousQuantity - quantity;
  item.quantityRemaining = newQuantity;
  await item.save();

  return createTransaction({
    inventoryItem: item._id, batch: usedBatch?._id, transactionType, quantity: -quantity,
    previousQuantity, newQuantity, unitCost: item.unitCost, referenceType, referenceId, reason, notes, performedBy,
  });
};


module.exports = { getExpirationStatus, selectFefoBatch, createTransaction, stockOutInternal, DEFAULT_EXPIRY_WARNING_DAYS };