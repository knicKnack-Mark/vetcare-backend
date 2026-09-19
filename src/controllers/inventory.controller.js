const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const InventoryBatch = require('../models/InventoryBatch');
const InventoryTransaction = require('../models/InventoryTransaction');
const { getExpirationStatus, selectFefoBatch, createTransaction, DEFAULT_EXPIRY_WARNING_DAYS } = require('../services/inventory.service');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// GET /api/inventory
const getItems = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, search, category, itemType, brand, manufacturer, supplier,
      stockStatus, status = 'active', sortBy = 'name', sortOrder = 'asc',
    } = req.query;

    const query = {};
    if (status !== 'all') query.status = status;
    if (category) query.category = category;
    if (itemType) query.itemType = itemType;
    if (brand) query.brand = brand;
    if (manufacturer) query.manufacturer = manufacturer;
    if (supplier) query.supplier = supplier;

    let items = await InventoryItem.find(query).sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 });

    if (search) {
      const s = search.toLowerCase();
      items = items.filter((i) =>
        i.name.toLowerCase().includes(s) || i.itemCode.toLowerCase().includes(s) ||
        i.genericName?.toLowerCase().includes(s) || i.brand?.toLowerCase().includes(s) ||
        i.manufacturer?.toLowerCase().includes(s)
      );
    }

    if (stockStatus) items = items.filter((i) => i.stockStatus === stockStatus);

    const total = items.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = items.slice(skip, skip + Number(limit));

    res.json({ success: true, data: paginated, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/inventory/summary
const getSummary = async (req, res) => {
  try {
    const items = await InventoryItem.find({ status: 'active' });
    const now = new Date();
    const warningDate = new Date(now.getTime() + DEFAULT_EXPIRY_WARNING_DAYS * 86400000);

    const batches = await InventoryBatch.find({ status: { $ne: 'inactive' } });

    const totalItems = items.length;
    const totalUnits = items.reduce((sum, i) => sum + i.quantityRemaining, 0);
    const totalInventoryValue = items.reduce((sum, i) => sum + i.quantityRemaining * i.unitCost, 0);
    const lowStock = items.filter((i) => i.stockStatus === 'low_stock').length;
    const outOfStock = items.filter((i) => i.stockStatus === 'out_of_stock').length;
    const expiringSoon = batches.filter((b) => b.expirationDate && b.expirationDate >= now && b.expirationDate <= warningDate && b.quantityRemaining > 0).length;
    const expired = batches.filter((b) => b.expirationDate && b.expirationDate < now && b.quantityRemaining > 0).length;

    res.json({ success: true, data: { totalItems, totalUnits, totalInventoryValue, lowStock, outOfStock, expiringSoon, expired } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/inventory/low-stock
const getLowStock = async (req, res) => {
  try {
    const items = await InventoryItem.find({ status: 'active' });
    const lowStock = items
      .filter((i) => i.stockStatus === 'low_stock' || i.stockStatus === 'out_of_stock')
      .map((i) => ({
        item: i.name, _id: i._id, itemCode: i.itemCode,
        quantityRemaining: i.quantityRemaining, reorderLevel: i.reorderLevel,
        minimumStockLevel: i.minimumStockLevel, suggestedReorderQuantity: i.reorderQuantity || i.reorderLevel * 2,
      }));
    res.json({ success: true, data: lowStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/inventory/out-of-stock
const getOutOfStock = async (req, res) => {
  try {
    const items = await InventoryItem.find({ status: 'active', quantityRemaining: { $lte: 0 } });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/inventory/expiring?days=30
const getExpiring = async (req, res) => {
  try {
    const days = Number(req.query.days) || DEFAULT_EXPIRY_WARNING_DAYS;
    const now = new Date();
    const future = new Date(now.getTime() + days * 86400000);

    const batches = await InventoryBatch.find({
      expirationDate: { $gte: now, $lte: future }, quantityRemaining: { $gt: 0 }, status: { $ne: 'inactive' },
    }).populate('inventoryItem', 'name itemCode');

    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/inventory/expired
const getExpired = async (req, res) => {
  try {
    const now = new Date();
    const batches = await InventoryBatch.find({
      expirationDate: { $lt: now }, quantityRemaining: { $gt: 0 }, status: { $ne: 'inactive' },
    }).populate('inventoryItem', 'name itemCode');

    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/inventory/:id
const getItemById = async (req, res) => {
  try {
    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found', errors: [] });

    const batches = await InventoryBatch.find({ inventoryItem: item._id }).sort({ expirationDate: 1 });
    const batchesWithStatus = batches.map((b) => ({ ...b.toObject(), expirationStatus: getExpirationStatus(b.expirationDate) }));

    res.json({ success: true, data: { item, batches: batchesWithStatus } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/inventory
const createItem = async (req, res) => {
  try {
    const { name, itemType, category, unit, itemCode, minimumStockLevel = 0, reorderLevel = 0, unitCost = 0, sellingPrice = 0 } = req.body;
    const errors = [];
    if (!name) errors.push({ field: 'name', message: 'Item name is required' });
    if (!itemType) errors.push({ field: 'itemType', message: 'Item type is required' });
    if (!category) errors.push({ field: 'category', message: 'Category is required' });
    if (!unit) errors.push({ field: 'unit', message: 'Unit is required' });
    if (!itemCode) errors.push({ field: 'itemCode', message: 'Item code is required' });
    if (minimumStockLevel < 0) errors.push({ field: 'minimumStockLevel', message: 'Cannot be negative' });
    if (reorderLevel < 0) errors.push({ field: 'reorderLevel', message: 'Cannot be negative' });
    if (unitCost < 0) errors.push({ field: 'unitCost', message: 'Cannot be negative' });
    if (sellingPrice < 0) errors.push({ field: 'sellingPrice', message: 'Cannot be negative' });

    if (errors.length > 0) return res.status(400).json({ success: false, message: 'Validation failed', errors });

    const duplicate = await InventoryItem.findOne({ itemCode });
    if (duplicate) return res.status(409).json({ success: false, message: 'Item code already exists', errors: [{ field: 'itemCode', message: 'Must be unique' }] });

    const item = await InventoryItem.create({ ...req.body, quantityRemaining: 0 });
    res.status(201).json({ success: true, data: { item } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PUT /api/inventory/:id
const updateItem = async (req, res) => {
  try {
    // Never trust frontend-provided stock/value fields on a plain update
    const { quantityRemaining, ...safeBody } = req.body;
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, safeBody, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found', errors: [] });
    res.json({ success: true, data: { item } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// PATCH /api/inventory/:id
const patchItem = async (req, res) => {
  try {
    const { quantityRemaining, ...safeBody } = req.body;
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, { $set: safeBody }, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found', errors: [] });
    res.json({ success: true, data: { item } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// DELETE /api/inventory/:id (deactivate, not delete)
const deactivateItem = async (req, res) => {
  try {
    const item = await InventoryItem.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found', errors: [] });
    res.json({ success: true, message: 'Item deactivated', data: { item } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/inventory/:id/stock-in
const stockIn = async (req, res) => {
  try {
    const { quantity, unitCost, batchNumber, lotNumber, manufacturingDate, expirationDate, supplier, referenceNumber, notes } = req.body;

    if (!quantity || quantity <= 0) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'quantity', message: 'Quantity must be positive' }] });

    if (expirationDate && manufacturingDate && new Date(expirationDate) < new Date(manufacturingDate)) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'expirationDate', message: 'Cannot be before manufacturing date' }] });
    }

    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found', errors: [] });
    if (item.status !== 'active') return res.status(400).json({ success: false, message: 'Cannot stock in an inactive item', errors: [] });

    const previousQuantity = item.quantityRemaining;
    const newQuantity = previousQuantity + Number(quantity);

    const batch = await InventoryBatch.create({
      inventoryItem: item._id, batchNumber, lotNumber, quantityReceived: quantity, quantityRemaining: quantity,
      unitCost: unitCost ?? item.unitCost, manufacturingDate, expirationDate, supplier, status: 'available',
    });

    item.quantityRemaining = newQuantity;
    if (unitCost !== undefined) item.unitCost = unitCost;
    if (supplier) item.supplier = supplier;
    await item.save();

    await createTransaction({
      inventoryItem: item._id, batch: batch._id, transactionType: 'stock_in', quantity, previousQuantity, newQuantity,
      unitCost: unitCost ?? item.unitCost, referenceNumber, referenceType: 'manual', reason: notes || 'Stock received', notes, performedBy: req.user._id,
    });

    res.json({ success: true, data: { item, batch } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/inventory/:id/stock-out
const stockOut = async (req, res) => {
  try {
    const { quantity, transactionType = 'usage', reason, referenceType, referenceId, notes } = req.body;
    if (!quantity || quantity <= 0) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'quantity', message: 'Quantity must be positive' }] });

    const transaction = await stockOutInternal({ inventoryItemId: req.params.id, quantity, transactionType, referenceType, referenceId, reason, notes, performedBy: req.user._id });
    const item = await InventoryItem.findById(req.params.id);
    res.json({ success: true, data: { item, transaction } });
  } catch (error) {
    if (error.message.includes('not found')) return res.status(404).json({ success: false, message: error.message, errors: [] });
    if (error.message.includes('Insufficient')) return res.status(400).json({ success: false, message: error.message, errors: [] });
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// POST /api/inventory/:id/adjust
const adjustStock = async (req, res) => {
  try {
    const { quantity, reason, notes } = req.body;

    if (quantity === undefined || quantity < 0) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'quantity', message: 'Adjusted quantity must be 0 or greater' }] });
    if (!reason) return res.status(400).json({ success: false, message: 'Validation failed', errors: [{ field: 'reason', message: 'Reason is required for adjustments' }] });

    const item = await InventoryItem.findById(req.params.id);
    if (!item) return res.status(404).json({ success: false, message: 'Inventory item not found', errors: [] });

    const previousQuantity = item.quantityRemaining;
    const difference = quantity - previousQuantity;
    item.quantityRemaining = quantity;
    await item.save();

    const transaction = await createTransaction({
      inventoryItem: item._id, transactionType: 'adjustment', quantity: difference, previousQuantity, newQuantity: quantity,
      unitCost: item.unitCost, referenceType: 'manual', reason, notes, performedBy: req.user._id,
    });

    res.json({ success: true, data: { item, transaction } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

// GET /api/inventory/:id/transactions
const getTransactions = async (req, res) => {
  try {
    const transactions = await InventoryTransaction.find({ inventoryItem: req.params.id })
      .populate('performedBy', 'name').populate('batch', 'batchNumber lotNumber')
      .sort({ transactionDate: -1 });
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message, errors: [] });
  }
};

module.exports = {
  getItems, getSummary, getLowStock, getOutOfStock, getExpiring, getExpired, getItemById,
  createItem, updateItem, patchItem, deactivateItem, stockIn, stockOut, adjustStock, getTransactions,
};